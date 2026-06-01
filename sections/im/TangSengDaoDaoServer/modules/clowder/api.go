package clowder

import (
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	commonmodule "github.com/TangSengDaoDao/TangSengDaoDaoServer/modules/common"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/common"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/log"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/wkhttp"
)

type Clowder struct {
	ctx           *config.Context
	groupCatsMu   sync.RWMutex
	groupCatState map[string]groupCatSyncResponse
	log.Log
	config commonmodule.ClowderBridgeConfig
}

const clowderAIDirectChannelID = "clowder_ai"

func New(ctx *config.Context) *Clowder {
	return &Clowder{
		ctx:           ctx,
		groupCatState: map[string]groupCatSyncResponse{},
		Log:           log.NewTLog("clowder"),
		config:        commonmodule.ClowderBridgeConfigFromEnv(),
	}
}

func (c *Clowder) SetConfig(config commonmodule.ClowderBridgeConfig) {
	c.config = config
}

func (c *Clowder) Route(r *wkhttp.WKHttp) {
	auth := r.Group("/v1/clowder", c.ctx.AuthMiddleware(r))
	{
		auth.GET("/status", c.status)
		auth.GET("/conversation", c.conversation)
		auth.GET("/conversation/agents", c.agentDirectory)
		auth.GET("/cats", c.catDirectory)
		auth.POST("/cats/connect", c.connectCatContact)
		auth.POST("/cats", c.createCatAndConnect)
		auth.POST("/group/cats/sync", c.syncGroupCats)
		auth.GET("/group/cats", c.groupCats)
		auth.POST("/conversation/bind", c.bindConversation)
		auth.POST("/conversation/focus", c.setFocus)
		auth.POST("/conversation/focus/clear", c.clearFocus)
		auth.POST("/conversation/message", c.conversationMessage)
	}

	r.POST("/api/im-web/clowder/outbound", c.outbound)
}

func (c *Clowder) status(ctx *wkhttp.Context) {
	ctx.JSON(http.StatusOK, map[string]interface{}{
		"enabled":    c.config.Enabled,
		"configured": c.config.IsConfigured(),
		"reachable":  c.config.IsConfigured(),
		"version":    "3.0",
		"state":      c.state(),
		"featureFlags": map[string]interface{}{
			"imWebClowder": c.config.Enabled,
		},
		"connectorId": c.config.ConnectorID,
	})
}

type AgentDirectoryResponse struct {
	ThreadID        string         `json:"threadId,omitempty"`
	Agents          []ClowderAgent `json:"agents"`
	PreferredCatIDs []string       `json:"preferredCatIds,omitempty"`
	LastActiveCatID string         `json:"lastActiveCatId,omitempty"`
}

type ClowderAgent struct {
	CatID              string   `json:"catId"`
	DisplayName        string   `json:"displayName"`
	Aliases            []string `json:"aliases,omitempty"`
	MentionPatterns    []string `json:"mentionPatterns"`
	Avatar             string   `json:"avatar,omitempty"`
	PersonalitySummary string   `json:"personalitySummary,omitempty"`
	CapabilitySummary  string   `json:"capabilitySummary,omitempty"`
	Available          bool     `json:"available"`
	AvailabilityState  string   `json:"availabilityState,omitempty"`
	Source             string   `json:"source,omitempty"`
	Connected          bool     `json:"connected,omitempty"`
	LastActiveAt       int64    `json:"lastActiveAt,omitempty"`
	MessageCount       int64    `json:"messageCount,omitempty"`
	Preferred          bool     `json:"preferred,omitempty"`
}

type conversationRefRequest struct {
	ChannelID     string   `json:"channelId"`
	ChannelType   uint8    `json:"channelType"`
	ThreadID      string   `json:"threadId,omitempty"`
	Title         string   `json:"title,omitempty"`
	CatID         string   `json:"catId,omitempty"`
	Text          string   `json:"text,omitempty"`
	DirectCatID   string   `json:"directCatId,omitempty"`
	TargetCatIDs  []string `json:"targetCatIds,omitempty"`
	PromptContext string   `json:"promptContext,omitempty"`
}

type catContactRequest struct {
	CatID string `json:"catId"`
}

type createCatRequest struct {
	Name         string   `json:"name"`
	Alias        string   `json:"alias,omitempty"`
	ClientID     string   `json:"clientId,omitempty"`
	Platform     string   `json:"platform,omitempty"`
	Personality  string   `json:"personality,omitempty"`
	Capabilities []string `json:"capabilities,omitempty"`
}

type catContactEnvelope struct {
	Agent   ClowderAgent `json:"agent"`
	Contact struct {
		Connected bool   `json:"connected"`
		Source    string `json:"source"`
	} `json:"contact"`
}

type groupCatSyncRequest struct {
	GroupID          string         `json:"groupId"`
	GroupName        string         `json:"groupName"`
	CatIDs           []string       `json:"catIds"`
	Cats             []ClowderAgent `json:"cats,omitempty"`
	Prompt           string         `json:"prompt"`
	ProactiveReplies bool           `json:"proactiveReplies,omitempty"`
}

type groupCatSyncResponse struct {
	GroupID          string         `json:"groupId"`
	GroupName        string         `json:"groupName"`
	CatIDs           []string       `json:"catIds"`
	Cats             []ClowderAgent `json:"cats"`
	Prompt           string         `json:"prompt"`
	ProactiveReplies bool           `json:"proactiveReplies,omitempty"`
}

func (c *Clowder) conversation(ctx *wkhttp.Context) {
	channelID, channelType, ok := c.queryConversationRef(ctx)
	if !ok {
		return
	}
	directory, err := c.fetchAgentDirectory(channelID, channelType, ctx.GetLoginUID())
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "agent_directory_unavailable", "message": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, c.conversationState(channelID, channelType, ctx.GetLoginUID(), directory))
}

func (c *Clowder) agentDirectory(ctx *wkhttp.Context) {
	channelID, channelType, ok := c.queryConversationRef(ctx)
	if !ok {
		return
	}
	directory, err := c.fetchAgentDirectory(channelID, channelType, ctx.GetLoginUID())
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "agent_directory_unavailable", "message": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, directory)
}

func (c *Clowder) catDirectory(ctx *wkhttp.Context) {
	directory, err := c.fetchCatDirectory(ctx.GetLoginUID())
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "cat_directory_unavailable", "message": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, directory)
}

func (c *Clowder) connectCatContact(ctx *wkhttp.Context) {
	var req catContactRequest
	if err := ctx.BindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_body"})
		return
	}
	if strings.TrimSpace(req.CatID) == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "cat_required"})
		return
	}
	directory, err := c.fetchCatDirectory(ctx.GetLoginUID())
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "cat_directory_unavailable", "message": err.Error()})
		return
	}
	response, ok := catContactResponse(req.CatID, directory, "existing")
	if !ok {
		ctx.JSON(http.StatusNotFound, map[string]string{"error": "cat_not_found"})
		return
	}
	ctx.JSON(http.StatusOK, response)
}

func (c *Clowder) createCatAndConnect(ctx *wkhttp.Context) {
	var req createCatRequest
	if err := ctx.BindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_body"})
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "name_required"})
		return
	}
	createCommand, ok := buildCreateCatCommand(req)
	if !ok {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "platform_required"})
		return
	}
	alias := normalizeCatAlias(req.Alias, name)
	if _, err := c.sendCommand(clowderAIDirectChannelID, 1, ctx.GetLoginUID(), createCommand); err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "cat_create_failed", "message": err.Error()})
		return
	}
	if directory, err := c.fetchCatDirectory(ctx.GetLoginUID()); err == nil {
		if response, ok := catContactResponse(name, directory, "runtime-created"); ok {
			ctx.JSON(http.StatusOK, response)
			return
		}
		if response, ok := catContactResponse(alias, directory, "runtime-created"); ok {
			ctx.JSON(http.StatusOK, response)
			return
		}
	}
	if _, err := c.sendCommand(clowderAIDirectChannelID, 1, ctx.GetLoginUID(), "/new IM Web 猫猫联系人"); err == nil {
		if _, err := c.sendCommand(clowderAIDirectChannelID, 1, ctx.GetLoginUID(), createCommand); err != nil {
			ctx.JSON(http.StatusBadGateway, map[string]string{"error": "cat_create_failed", "message": err.Error()})
			return
		}
		if directory, err := c.fetchCatDirectory(ctx.GetLoginUID()); err == nil {
			if response, ok := catContactResponse(name, directory, "runtime-created"); ok {
				ctx.JSON(http.StatusOK, response)
				return
			}
			if response, ok := catContactResponse(alias, directory, "runtime-created"); ok {
				ctx.JSON(http.StatusOK, response)
				return
			}
		}
	}
	ctx.JSON(http.StatusOK, fallbackCreatedCatResponse(req, alias))
}

func (c *Clowder) syncGroupCats(ctx *wkhttp.Context) {
	var req groupCatSyncRequest
	if err := ctx.BindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_body"})
		return
	}
	if strings.TrimSpace(req.GroupID) == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "group_required"})
		return
	}
	ctx.JSON(http.StatusOK, c.storeGroupCats(req))
}

func (c *Clowder) groupCats(ctx *wkhttp.Context) {
	groupID := strings.TrimSpace(ctx.Query("groupId"))
	if groupID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "group_required"})
		return
	}
	if response, ok := c.loadGroupCats(groupID); ok {
		ctx.JSON(http.StatusOK, response)
		return
	}
	ctx.JSON(http.StatusOK, groupCatSyncResponse{
		GroupID: groupID,
		CatIDs:  []string{},
		Cats:    []ClowderAgent{},
		Prompt:  "",
	})
}

func (c *Clowder) storeGroupCats(req groupCatSyncRequest) groupCatSyncResponse {
	groupID := strings.TrimSpace(req.GroupID)
	response := groupCatSyncResponse{
		GroupID:          groupID,
		GroupName:        strings.TrimSpace(req.GroupName),
		CatIDs:           cleanStringList(req.CatIDs),
		Cats:             decorateGroupCats(req.Cats),
		Prompt:           strings.TrimSpace(req.Prompt),
		ProactiveReplies: req.ProactiveReplies,
	}
	c.groupCatsMu.Lock()
	if c.groupCatState == nil {
		c.groupCatState = map[string]groupCatSyncResponse{}
	}
	c.groupCatState[groupID] = response
	c.groupCatsMu.Unlock()
	return response
}

func (c *Clowder) loadGroupCats(groupID string) (groupCatSyncResponse, bool) {
	c.groupCatsMu.RLock()
	defer c.groupCatsMu.RUnlock()
	if c.groupCatState == nil {
		return groupCatSyncResponse{}, false
	}
	response, ok := c.groupCatState[strings.TrimSpace(groupID)]
	return response, ok
}

func decorateGroupCats(cats []ClowderAgent) []ClowderAgent {
	decorated := make([]ClowderAgent, 0, len(cats))
	for _, cat := range cats {
		decorated = append(decorated, decorateCatContact(cat, "existing"))
	}
	return decorated
}

func (c *Clowder) bindConversation(ctx *wkhttp.Context) {
	var req conversationRefRequest
	if err := ctx.BindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_body"})
		return
	}
	if req.ChannelID == "" || req.ChannelType == 0 {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "channel_required"})
		return
	}
	text := "/new"
	if strings.TrimSpace(req.Title) != "" {
		text = "/new " + strings.TrimSpace(req.Title)
	}
	response, err := c.sendCommand(req.ChannelID, req.ChannelType, ctx.GetLoginUID(), text)
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "bind_failed", "message": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, IMConnectorBinding{
		ConnectorID:    ConnectorID,
		ExternalChatID: externalChatIDForUser(req.ChannelID, req.ChannelType, ctx.GetLoginUID()),
		ChannelID:      req.ChannelID,
		ChannelType:    req.ChannelType,
		ThreadID:       response.ThreadID,
		UserID:         ctx.GetLoginUID(),
		Status:         BindingStatusActive,
	})
}

func (c *Clowder) setFocus(ctx *wkhttp.Context) {
	var req conversationRefRequest
	if err := ctx.BindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_body"})
		return
	}
	if req.ChannelID == "" || req.ChannelType == 0 || strings.TrimSpace(req.CatID) == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "channel_and_cat_required"})
		return
	}
	if _, err := c.sendCommand(req.ChannelID, req.ChannelType, ctx.GetLoginUID(), "/focus "+strings.TrimSpace(req.CatID)); err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "focus_failed", "message": err.Error()})
		return
	}
	directory, err := c.fetchAgentDirectory(req.ChannelID, req.ChannelType, ctx.GetLoginUID())
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "agent_directory_unavailable", "message": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, c.conversationState(req.ChannelID, req.ChannelType, ctx.GetLoginUID(), directory))
}

func (c *Clowder) clearFocus(ctx *wkhttp.Context) {
	var req conversationRefRequest
	if err := ctx.BindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_body"})
		return
	}
	if req.ChannelID == "" || req.ChannelType == 0 {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "channel_required"})
		return
	}
	if _, err := c.sendCommand(req.ChannelID, req.ChannelType, ctx.GetLoginUID(), "/focus clear"); err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "focus_failed", "message": err.Error()})
		return
	}
	directory, err := c.fetchAgentDirectory(req.ChannelID, req.ChannelType, ctx.GetLoginUID())
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "agent_directory_unavailable", "message": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, c.conversationState(req.ChannelID, req.ChannelType, ctx.GetLoginUID(), directory))
}

func (c *Clowder) conversationMessage(ctx *wkhttp.Context) {
	var req conversationRefRequest
	if err := ctx.BindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_body"})
		return
	}
	if req.ChannelID == "" || req.ChannelType == 0 || strings.TrimSpace(req.Text) == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "channel_and_text_required"})
		return
	}
	response, err := c.sendInboundTextWithRouting(req.ChannelID, req.ChannelType, ctx.GetLoginUID(), routeTextForCatRequest(req), req.DirectCatID, req.TargetCatIDs, req.PromptContext)
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "message_failed", "message": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, response)
}

func (c *Clowder) outbound(ctx *wkhttp.Context) {
	rawBody, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_body"})
		return
	}
	err = commonmodule.VerifyClowderSignature(
		rawBody,
		c.config.ConnectorSecret,
		ctx.GetHeader("x-clowder-timestamp"),
		ctx.GetHeader("x-clowder-signature"),
		time.Now(),
		c.config.SignatureTolerance,
	)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid_signature"})
		return
	}

	var payload OutboundPayload
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_body"})
		return
	}
	if payload.ConnectorID != "" && payload.ConnectorID != ConnectorID {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_connector"})
		return
	}
	msgReq, err := BuildOutboundMessageWithDefaultRecipient(payload, c.config.DefaultOwnerUserID)
	if err != nil {
		if errors.Is(err, ErrOutboundNoop) {
			ctx.JSON(http.StatusOK, map[string]interface{}{"ok": true, "skipped": "noop"})
			return
		}
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_payload", "message": err.Error()})
		return
	}
	if isClowderVirtualSenderUID(msgReq.FromUID) {
		if err := c.ensureVirtualClowderUser(msgReq.FromUID, virtualClowderDisplayName(msgReq.FromUID, payload)); err != nil {
			c.Error("ensure clowder virtual user failed")
			ctx.JSON(http.StatusBadGateway, map[string]string{"error": "virtual_user_failed", "message": err.Error()})
			return
		}
		if msgReq.ChannelType == common.ChannelTypeGroup.Uint8() {
			subscribers, err := c.groupOutboundSubscriberUIDs(msgReq.ChannelID)
			if err != nil {
				c.Error("load clowder group subscribers failed")
				ctx.JSON(http.StatusBadGateway, map[string]string{"error": "group_subscribers_failed", "message": err.Error()})
				return
			}
			applyGroupOutboundSubscribers(msgReq, subscribers)
		}
	}
	if err := c.ctx.SendMessage(msgReq); err != nil {
		c.Error("send clowder outbound message failed")
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "send_failed", "message": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, map[string]interface{}{
		"ok": true,
	})
}

func (c *Clowder) queryConversationRef(ctx *wkhttp.Context) (string, uint8, bool) {
	channelID := strings.TrimSpace(ctx.Query("channelId"))
	channelTypeRaw := strings.TrimSpace(ctx.Query("channelType"))
	if channelID == "" || channelTypeRaw == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "channel_required"})
		return "", 0, false
	}
	channelType, err := strconv.ParseUint(channelTypeRaw, 10, 8)
	if err != nil || channelType == 0 {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_channel_type"})
		return "", 0, false
	}
	return channelID, uint8(channelType), true
}

func (c *Clowder) fetchAgentDirectory(channelID string, channelType uint8, userID string) (AgentDirectoryResponse, error) {
	if !c.config.IsConfigured() {
		return AgentDirectoryResponse{}, fmt.Errorf("clowder bridge is not configured")
	}
	endpoint, err := url.Parse(strings.TrimRight(c.config.APIBaseURL, "/") + "/api/connectors/im-web/agents")
	if err != nil {
		return AgentDirectoryResponse{}, err
	}
	query := endpoint.Query()
	query.Set("externalChatId", externalChatIDForUser(channelID, channelType, userID))
	endpoint.RawQuery = query.Encode()

	req, err := http.NewRequest(http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return AgentDirectoryResponse{}, err
	}
	directoryUserID := strings.TrimSpace(c.config.DefaultOwnerUserID)
	if directoryUserID == "" {
		directoryUserID = strings.TrimSpace(userID)
	}
	if directoryUserID != "" {
		req.Header.Set("x-cat-cafe-user", directoryUserID)
	}

	res, err := c.httpClient().Do(req)
	if err != nil {
		return AgentDirectoryResponse{}, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return AgentDirectoryResponse{}, fmt.Errorf("clowder agents failed: %s", res.Status)
	}

	var directory AgentDirectoryResponse
	if err := json.NewDecoder(res.Body).Decode(&directory); err != nil {
		return AgentDirectoryResponse{}, err
	}
	if directory.Agents == nil {
		directory.Agents = []ClowderAgent{}
	}
	return directory, nil
}

func (c *Clowder) fetchCatDirectory(userID string) (AgentDirectoryResponse, error) {
	directory, err := c.fetchAgentDirectory(clowderAIDirectChannelID, 1, userID)
	if err != nil {
		return AgentDirectoryResponse{}, err
	}
	for idx := range directory.Agents {
		directory.Agents[idx] = decorateCatContact(directory.Agents[idx], "existing")
	}
	return directory, nil
}

func (c *Clowder) sendCommand(channelID string, channelType uint8, userID string, text string) (RouteResponse, error) {
	return c.sendInboundText(channelID, channelType, userID, text)
}

func (c *Clowder) sendInboundText(channelID string, channelType uint8, userID string, text string) (RouteResponse, error) {
	return c.sendInboundTextWithRouting(channelID, channelType, userID, text, "", nil, "")
}

func (c *Clowder) sendInboundTextWithRouting(channelID string, channelType uint8, userID string, text string, directCatID string, targetCatIDs []string, promptContext string) (RouteResponse, error) {
	return NewClient(c.config.APIBaseURL, c.config.ConnectorSecret, c.config.RequestTimeout).ForwardInbound(InboundMessage{
		ConnectorID:    ConnectorID,
		ExternalChatID: externalChatIDForUser(channelID, channelType, userID),
		ChannelID:      channelID,
		ChannelType:    channelType,
		ChatType:       chatType(channelType),
		MessageID:      commandMessageID(text),
		ClientMsgNo:    commandMessageID(text),
		Text:           text,
		Timestamp:      time.Now().UnixMilli(),
		Sender: Sender{
			ID: userID,
		},
		DirectCatID:   strings.TrimSpace(directCatID),
		TargetCatIDs:  cleanStringList(targetCatIDs),
		PromptContext: strings.TrimSpace(promptContext),
	})
}

func catContactResponse(catID string, directory AgentDirectoryResponse, source string) (catContactEnvelope, bool) {
	needle := strings.TrimSpace(catID)
	if needle == "" {
		return catContactEnvelope{}, false
	}
	normalizedNeedle := normalizeCatLookup(needle)
	for _, agent := range directory.Agents {
		if normalizeCatLookup(agent.CatID) == normalizedNeedle ||
			normalizeCatLookup(agent.DisplayName) == normalizedNeedle ||
			containsNormalized(agent.MentionPatterns, normalizedNeedle) ||
			containsNormalized(agent.Aliases, normalizedNeedle) {
			return catEnvelope(decorateCatContact(agent, source), source), true
		}
	}
	return catContactEnvelope{}, false
}

func catEnvelope(agent ClowderAgent, source string) catContactEnvelope {
	response := catContactEnvelope{Agent: agent}
	response.Contact.Connected = true
	response.Contact.Source = source
	return response
}

func decorateCatContact(agent ClowderAgent, source string) ClowderAgent {
	if agent.MentionPatterns == nil {
		agent.MentionPatterns = []string{}
	}
	if agent.Aliases == nil {
		agent.Aliases = agent.MentionPatterns
	}
	if agent.AvailabilityState == "" {
		if agent.Available {
			agent.AvailabilityState = "available"
		} else {
			agent.AvailabilityState = "unavailable"
		}
	}
	if agent.Source == "" {
		agent.Source = source
	}
	agent.Connected = true
	return agent
}

func fallbackCreatedCatResponse(req createCatRequest, alias string) catContactEnvelope {
	name := strings.TrimSpace(req.Name)
	agent := ClowderAgent{
		CatID:              fallbackCatID(name, alias),
		DisplayName:        name,
		Aliases:            []string{alias},
		MentionPatterns:    []string{alias},
		PersonalitySummary: strings.TrimSpace(req.Personality),
		CapabilitySummary:  strings.Join(cleanStringList(req.Capabilities), "、"),
		Available:          true,
	}
	return catEnvelope(decorateCatContact(agent, "runtime-created"), "runtime-created")
}

func routeTextForCatRequest(req conversationRefRequest) string {
	text := strings.TrimSpace(req.Text)
	if text == "" {
		return ""
	}
	directCatID := strings.TrimSpace(req.DirectCatID)
	if directCatID != "" {
		return prefixCatMentions([]string{directCatID}, text)
	}
	targetCatIDs := cleanStringList(req.TargetCatIDs)
	if len(targetCatIDs) > 0 {
		return prefixCatMentions(targetCatIDs, text)
	}
	return text
}

func prefixCatMentions(catIDs []string, text string) string {
	prefixes := make([]string, 0, len(catIDs))
	for _, catID := range cleanStringList(catIDs) {
		mention := strings.TrimSpace(catID)
		if mention == "" {
			continue
		}
		if !strings.HasPrefix(mention, "@") {
			mention = "@" + mention
		}
		prefixes = append(prefixes, mention)
	}
	if len(prefixes) == 0 {
		return text
	}
	return strings.Join(prefixes, " ") + " " + text
}

func normalizeCatAlias(alias string, name string) string {
	value := strings.TrimSpace(alias)
	if value == "" {
		value = strings.TrimSpace(name)
	}
	value = strings.TrimPrefix(value, "@")
	if value == "" {
		value = "cat"
	}
	return "@" + value
}

func normalizeCatClientPlatform(req createCatRequest) string {
	value := strings.ToLower(strings.TrimSpace(req.ClientID))
	if value == "" {
		value = strings.ToLower(strings.TrimSpace(req.Platform))
	}
	value = strings.ReplaceAll(value, "_", "-")
	switch value {
	case "openai", "codex":
		return "codex"
	case "anthropic", "claude", "claude-code":
		return "claude-code"
	default:
		return ""
	}
}

func buildCreateCatCommand(req createCatRequest) (string, bool) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return "", false
	}
	platform := normalizeCatClientPlatform(req)
	if platform == "" {
		return "", false
	}
	alias := normalizeCatAlias(req.Alias, name)
	return "/cats new " + name + " " + alias + " --platform " + platform, true
}

func fallbackCatID(name string, alias string) string {
	raw := strings.TrimPrefix(strings.TrimSpace(alias), "@")
	if raw == "" {
		raw = strings.TrimSpace(name)
	}
	var builder strings.Builder
	for _, r := range strings.ToLower(raw) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			builder.WriteRune(r)
			continue
		}
		if r == '-' || r == '_' {
			builder.WriteRune(r)
		}
	}
	value := strings.Trim(builder.String(), "-_")
	if value == "" {
		value = fmt.Sprintf("runtime-cat-%x", time.Now().UnixNano())
	}
	return value
}

func cleanStringList(values []string) []string {
	cleaned := make([]string, 0, len(values))
	seen := map[string]bool{}
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" || seen[trimmed] {
			continue
		}
		seen[trimmed] = true
		cleaned = append(cleaned, trimmed)
	}
	return cleaned
}

func containsNormalized(values []string, needle string) bool {
	for _, value := range values {
		if normalizeCatLookup(value) == needle {
			return true
		}
	}
	return false
}

func normalizeCatLookup(value string) string {
	return strings.TrimPrefix(strings.ToLower(strings.TrimSpace(value)), "@")
}

func (c *Clowder) conversationState(channelID string, channelType uint8, userID string, directory AgentDirectoryResponse) map[string]interface{} {
	focusCatID := ""
	if len(directory.PreferredCatIDs) > 0 {
		focusCatID = directory.PreferredCatIDs[0]
	}
	state := map[string]interface{}{
		"status": map[string]interface{}{
			"enabled":     c.config.Enabled,
			"configured":  c.config.IsConfigured(),
			"reachable":   c.config.IsConfigured(),
			"version":     "3.0",
			"state":       c.state(),
			"connectorId": c.config.ConnectorID,
		},
		"agents": directory.Agents,
	}
	if directory.ThreadID != "" {
		state["binding"] = IMConnectorBinding{
			ConnectorID:    ConnectorID,
			ExternalChatID: externalChatIDForUser(channelID, channelType, userID),
			ChannelID:      channelID,
			ChannelType:    channelType,
			ThreadID:       directory.ThreadID,
			UserID:         c.config.DefaultOwnerUserID,
			Status:         BindingStatusActive,
		}
	}
	if focusCatID != "" {
		state["focusCatId"] = focusCatID
	}
	return state
}

func (c *Clowder) httpClient() *http.Client {
	timeout := c.config.RequestTimeout
	if timeout == 0 {
		timeout = 5 * time.Second
	}
	return &http.Client{Timeout: timeout}
}

func externalChatID(channelID string, channelType uint8) string {
	return fmt.Sprintf("%d:%s", channelType, channelID)
}

func externalChatIDForUser(channelID string, channelType uint8, userID string) string {
	if channelType == 1 && isClowderVirtualDirectChannelID(channelID) && strings.TrimSpace(userID) != "" {
		return externalChatID(common.GetFakeChannelIDWith(userID, channelID), channelType)
	}
	return externalChatID(channelID, channelType)
}

func (c *Clowder) ensureVirtualClowderUser(uid string, name string) error {
	sql, args := virtualClowderUserUpsert(uid, name)
	_, err := c.ctx.DB().InsertBySql(sql, args...).Exec()
	return err
}

func (c *Clowder) groupOutboundSubscriberUIDs(groupNo string) ([]string, error) {
	var subscribers []string
	_, err := c.ctx.DB().
		Select("uid").
		From("group_member").
		Where("group_no=? and is_deleted=0 and status=1", groupNo).
		Load(&subscribers)
	return subscribers, err
}

func virtualClowderUserUpsert(uidAndName ...string) (string, []interface{}) {
	uid := clowderAIDirectChannelID
	name := "Clowder AI"
	if len(uidAndName) > 0 && strings.TrimSpace(uidAndName[0]) != "" {
		uid = strings.TrimSpace(uidAndName[0])
	}
	if len(uidAndName) > 1 && strings.TrimSpace(uidAndName[1]) != "" {
		name = strings.TrimSpace(uidAndName[1])
	} else if uid != clowderAIDirectChannelID {
		name = uid
	}
	shortNo, phone := virtualClowderLookupFields(uid)
	return "insert into `user` (uid,name,username,short_no,phone,zone,search_by_phone,search_by_short,new_msg_notice,voice_on,shock_on,msg_show_detail,status,is_upload_avatar,category,robot) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),username=VALUES(username),phone=VALUES(phone),zone=VALUES(zone),status=VALUES(status),category=VALUES(category),robot=VALUES(robot),updated_at=NOW()", []interface{}{
		uid,
		name,
		uid,
		shortNo,
		phone,
		"0086",
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		1,
		"clowder",
		1,
	}
}

func virtualClowderLookupFields(uid string) (string, string) {
	if uid == clowderAIDirectChannelID {
		return "21001", "13000021001"
	}
	h := fnv.New32a()
	_, _ = h.Write([]byte(uid))
	value := h.Sum32() % 100000000
	return fmt.Sprintf("21%08d", value), fmt.Sprintf("13%09d", value)
}

func isClowderVirtualSenderUID(uid string) bool {
	trimmed := strings.TrimSpace(uid)
	return trimmed == clowderAIDirectChannelID ||
		strings.HasPrefix(trimmed, "clowder:") ||
		strings.HasPrefix(trimmed, "clowder_cat:")
}

func virtualClowderDisplayName(uid string, payload OutboundPayload) string {
	if strings.TrimSpace(payload.CatDisplayName) != "" {
		return strings.TrimSpace(payload.CatDisplayName)
	}
	if strings.TrimSpace(payload.CatID) != "" {
		return strings.TrimSpace(payload.CatID)
	}
	if strings.TrimSpace(uid) == clowderAIDirectChannelID {
		return "Clowder AI"
	}
	return strings.TrimSpace(uid)
}

func commandMessageID(text string) string {
	return fmt.Sprintf("im-web-command-%d-%x", time.Now().UnixNano(), []byte(text))
}

func (c *Clowder) state() string {
	if !c.config.Enabled {
		return "disabled"
	}
	if !c.config.IsConfigured() {
		return "unconfigured"
	}
	return "ready"
}
