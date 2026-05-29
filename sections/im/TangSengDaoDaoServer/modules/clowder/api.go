package clowder

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	commonmodule "github.com/TangSengDaoDao/TangSengDaoDaoServer/modules/common"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/common"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/log"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/wkhttp"
)

type Clowder struct {
	ctx *config.Context
	log.Log
	config commonmodule.ClowderBridgeConfig
}

const clowderAIDirectChannelID = "clowder_ai"

func New(ctx *config.Context) *Clowder {
	return &Clowder{
		ctx:    ctx,
		Log:    log.NewTLog("clowder"),
		config: commonmodule.ClowderBridgeConfigFromEnv(),
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
	CatID           string   `json:"catId"`
	DisplayName     string   `json:"displayName"`
	MentionPatterns []string `json:"mentionPatterns"`
	Available       bool     `json:"available"`
	LastActiveAt    int64    `json:"lastActiveAt,omitempty"`
	MessageCount    int64    `json:"messageCount,omitempty"`
	Preferred       bool     `json:"preferred,omitempty"`
}

type conversationRefRequest struct {
	ChannelID   string `json:"channelId"`
	ChannelType uint8  `json:"channelType"`
	ThreadID    string `json:"threadId,omitempty"`
	Title       string `json:"title,omitempty"`
	CatID       string `json:"catId,omitempty"`
	Text        string `json:"text,omitempty"`
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
	response, err := c.sendInboundText(req.ChannelID, req.ChannelType, ctx.GetLoginUID(), strings.TrimSpace(req.Text))
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
	msgReq, err := BuildOutboundMessage(payload)
	if err != nil {
		if errors.Is(err, ErrOutboundNoop) {
			ctx.JSON(http.StatusOK, map[string]interface{}{"ok": true, "skipped": "noop"})
			return
		}
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_payload", "message": err.Error()})
		return
	}
	if msgReq.FromUID == clowderAIDirectChannelID {
		if err := c.ensureVirtualClowderUser(); err != nil {
			c.Error("ensure clowder virtual user failed")
			ctx.JSON(http.StatusBadGateway, map[string]string{"error": "virtual_user_failed", "message": err.Error()})
			return
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
	if strings.TrimSpace(userID) != "" {
		req.Header.Set("x-cat-cafe-user", strings.TrimSpace(userID))
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

func (c *Clowder) sendCommand(channelID string, channelType uint8, userID string, text string) (RouteResponse, error) {
	return c.sendInboundText(channelID, channelType, userID, text)
}

func (c *Clowder) sendInboundText(channelID string, channelType uint8, userID string, text string) (RouteResponse, error) {
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
	})
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
	if channelType == 1 && strings.TrimSpace(channelID) == clowderAIDirectChannelID && strings.TrimSpace(userID) != "" {
		return externalChatID(common.GetFakeChannelIDWith(userID, channelID), channelType)
	}
	return externalChatID(channelID, channelType)
}

func (c *Clowder) ensureVirtualClowderUser() error {
	sql, args := virtualClowderUserUpsert()
	_, err := c.ctx.DB().InsertBySql(sql, args...).Exec()
	return err
}

func virtualClowderUserUpsert() (string, []interface{}) {
	return "insert into `user` (uid,name,username,short_no,phone,zone,search_by_phone,search_by_short,new_msg_notice,voice_on,shock_on,msg_show_detail,status,is_upload_avatar,category,robot) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),username=VALUES(username),phone=VALUES(phone),zone=VALUES(zone),status=VALUES(status),category=VALUES(category),robot=VALUES(robot),updated_at=NOW()", []interface{}{
		clowderAIDirectChannelID,
		"Clowder AI",
		clowderAIDirectChannelID,
		"21001",
		"13000021001",
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
