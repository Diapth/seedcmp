package clowder

import (
	"bytes"
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
		auth.GET("/local-auth/capabilities", c.localAuthCapabilities)
		auth.POST("/cats/connect", c.connectCatContact)
		auth.POST("/cats", c.createCatAndConnect)
		auth.DELETE("/cats/:catId", c.deleteCatContact)
		auth.POST("/group/cats/sync", c.syncGroupCats)
		auth.GET("/group/cats", c.groupCats)
		auth.POST("/conversation/bind", c.bindConversation)
		auth.POST("/conversation/focus", c.setFocus)
		auth.POST("/conversation/focus/clear", c.clearFocus)
		auth.POST("/conversation/message", c.conversationMessage)
		auth.POST("/conversation/deployment-request", c.conversationDeploymentRequest)
		auth.RouterGroup.PATCH("/conversation/deployment-request/:deploymentRequestId", auth.L.WKHttpHandler(c.conversationDeploymentRequestUpdate))
		auth.GET("/conversation/deployment-request/active", c.conversationDeploymentRequestActive)
		auth.POST("/conversation/deployment-action", c.conversationDeploymentAction)
		// Phase 2: Coordinator kickoff — proxy GET/dismiss to Clowder 3004.
		// See sections/clowder-ai/packages/api/src/routes/coordinator-kickoff.ts.
		auth.GET("/coordinator/kickoff/:coordinationId", c.getCoordinatorKickoff)
		auth.GET("/coordinator/kickoffs", c.listCoordinatorKickoffs)
		auth.POST("/coordinator/kickoff/:coordinationId/dismiss", c.dismissCoordinatorKickoff)
		auth.POST("/coordinator/coordination", c.proxyCreateCoordination)
		auth.GET("/coordinator/coordination/:coordinationId", c.proxyGetCoordination)
		auth.RouterGroup.PATCH("/coordinator/coordination/:coordinationId", auth.L.WKHttpHandler(c.proxyPatchCoordination))
		auth.POST("/coordinator/coordination/:coordinationId/cancel", c.proxyCancelCoordination)
		// Phase 4.2: Workspace path validation — read-only preview of the
		// rules enforced by `POST /api/threads` in Clowder 3004.
		auth.GET("/workspace/validate", c.validateWorkspacePath)
		// Phase 4.5 + 5.2: thread tasks + artifacts REST.
		// We don't know the threadId prefix here, so we proxy the
		// `/v1/clowder/thread/...` shape to `/api/threads/...` upstream.
		auth.GET("/thread/:threadId/tasks", c.proxyThreadTasks)
		auth.GET("/thread/:threadId/coordinations", c.proxyThreadCoordinations)
		auth.GET("/thread/:threadId/artifacts", c.proxyThreadArtifacts)
		auth.POST("/thread/:threadId/artifacts", c.proxyPostThreadArtifact)
		auth.GET("/thread/:threadId/workspaces", c.proxyThreadWorkspaces)
		auth.GET("/thread/:threadId/workspace-binding", c.proxyGetThreadWorkspaceBinding)
		auth.PUT("/thread/:threadId/workspace-binding", c.proxyPutThreadWorkspaceBinding)
		// V3-37: user-visible Maomi project workspaces.
		auth.GET("/maomi-workspaces/root", c.proxyMaomiWorkspaceRoot)
		auth.POST("/maomi-workspaces/propose", c.proxyPostMaomiWorkspacePropose)
		auth.POST("/maomi-workspaces", c.proxyPostMaomiWorkspace)
		auth.GET("/maomi-workspaces", c.proxyListMaomiWorkspaces)
		auth.GET("/maomi-workspaces/:workspaceId", c.proxyGetMaomiWorkspace)
		auth.POST("/maomi-workspaces/:workspaceId/archive", c.proxyArchiveMaomiWorkspace)
		// im_web creates new project group threads via
		// POST /v1/threads (handled by the bridge below).
		auth.POST("/threads", c.proxyCreateThread)
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

type CatDirectoryResponse struct {
	Agents    []ClowderAgent       `json:"agents"`
	Templates []ClowderCatTemplate `json:"templates,omitempty"`
}

type ClowderCatTemplate struct {
	RoleTemplateID     string   `json:"roleTemplateId"`
	CatID              string   `json:"catId"`
	DisplayName        string   `json:"displayName"`
	Aliases            []string `json:"aliases,omitempty"`
	MentionPatterns    []string `json:"mentionPatterns,omitempty"`
	Avatar             string   `json:"avatar,omitempty"`
	PersonalitySummary string   `json:"personalitySummary,omitempty"`
	CapabilitySummary  string   `json:"capabilitySummary,omitempty"`
	Cloneable          bool     `json:"cloneable"`
	UnavailableReason  string   `json:"unavailableReason,omitempty"`
	Source             string   `json:"source,omitempty"`
}

type catTemplatesResponse struct {
	Templates []catTemplate `json:"templates"`
}

type catTemplate struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Nickname        string `json:"nickname,omitempty"`
	Avatar          string `json:"avatar,omitempty"`
	RoleDescription string `json:"roleDescription,omitempty"`
	Personality     string `json:"personality,omitempty"`
	TeamStrengths   string `json:"teamStrengths,omitempty"`
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
	Name           string   `json:"name"`
	Alias          string   `json:"alias,omitempty"`
	RoleTemplateID string   `json:"roleTemplateId,omitempty"`
	ClientID       string   `json:"clientId,omitempty"`
	Platform       string   `json:"platform,omitempty"`
	AuthType       string   `json:"authType,omitempty"`
	AccountRef     string   `json:"accountRef,omitempty"`
	DefaultModel   string   `json:"defaultModel,omitempty"`
	Personality    string   `json:"personality,omitempty"`
	Capabilities   []string `json:"capabilities,omitempty"`
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
	AutoReplyMode    string         `json:"autoReplyMode,omitempty"`
}

type groupCatSyncResponse struct {
	GroupID          string         `json:"groupId"`
	GroupName        string         `json:"groupName"`
	CatIDs           []string       `json:"catIds"`
	Cats             []ClowderAgent `json:"cats"`
	Prompt           string         `json:"prompt"`
	ProactiveReplies bool           `json:"proactiveReplies,omitempty"`
	AutoReplyMode    string         `json:"autoReplyMode,omitempty"`
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

func (c *Clowder) localAuthCapabilities(ctx *wkhttp.Context) {
	statusCode, body, err := c.fetchLocalAuthCapabilities(ctx.GetLoginUID())
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "local_auth_capabilities_unavailable", "message": err.Error()})
		return
	}
	ctx.Data(statusCode, "application/json; charset=utf-8", body)
}

// getCoordinatorKickoff proxies `GET /api/coordinator/kickoff/:coordinationId`
// from the Clowder 3004 backend. Used by im_web to pull the latest kickoff
// emitted by the coordinator (the primary signal is the WebSocket event
// `coordinator_kickoff`; this REST route is a fallback / refresh path).
func (c *Clowder) getCoordinatorKickoff(ctx *wkhttp.Context) {
	coordinationID := strings.TrimSpace(ctx.Param("coordinationId"))
	if coordinationID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "coordination_id_required"})
		return
	}
	if !c.config.IsConfigured() {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "clowder_bridge_not_configured"})
		return
	}
	endpoint := strings.TrimRight(c.config.APIBaseURL, "/") +
		"/api/coordinator/kickoff/" + url.PathEscape(coordinationID)

	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, map[string]string{"error": "build_request_failed", "message": err.Error()})
		return
	}
	c.applyDirectoryUserHeader(req, ctx.GetLoginUID())

	res, err := c.httpClient().Do(req)
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "kickoff_unavailable", "message": err.Error()})
		return
	}
	defer res.Body.Close()

	body, _ := io.ReadAll(res.Body)
	ctx.Data(res.StatusCode, "application/json; charset=utf-8", body)
}

// dismissCoordinatorKickoff proxies
// `POST /api/coordinator/kickoff/:coordinationId/dismiss` to Clowder 3004.
// Called when the user clicks "稍后再说" on the im_web kickoff card.
func (c *Clowder) dismissCoordinatorKickoff(ctx *wkhttp.Context) {
	coordinationID := strings.TrimSpace(ctx.Param("coordinationId"))
	if coordinationID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "coordination_id_required"})
		return
	}
	if !c.config.IsConfigured() {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "clowder_bridge_not_configured"})
		return
	}
	endpoint := strings.TrimRight(c.config.APIBaseURL, "/") +
		"/api/coordinator/kickoff/" + url.PathEscape(coordinationID) + "/dismiss"

	req, err := http.NewRequest(http.MethodPost, endpoint, nil)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, map[string]string{"error": "build_request_failed", "message": err.Error()})
		return
	}
	c.applyDirectoryUserHeader(req, ctx.GetLoginUID())

	res, err := c.httpClient().Do(req)
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "kickoff_dismiss_unavailable", "message": err.Error()})
		return
	}
	defer res.Body.Close()

	body, _ := io.ReadAll(res.Body)
	ctx.Data(res.StatusCode, "application/json; charset=utf-8", body)
}

// listCoordinatorKickoffs proxies
// `GET /api/coordinator/kickoffs?userId=...&maxAgeMs=...` to Clowder 3004.
// im_web polls this on panel mount to surface recent kickoffs without
// requiring WS plumbing across the two sub-projects.
func (c *Clowder) listCoordinatorKickoffs(ctx *wkhttp.Context) {
	if !c.config.IsConfigured() {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "clowder_bridge_not_configured"})
		return
	}
	endpoint := strings.TrimRight(c.config.APIBaseURL, "/") + "/api/coordinator/kickoffs"

	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, map[string]string{"error": "build_request_failed", "message": err.Error()})
		return
	}
	// Forward caller identity so the upstream can scope the listing.
	c.applyDirectoryUserHeader(req, ctx.GetLoginUID())
	if userID := strings.TrimSpace(ctx.Query("userId")); userID != "" {
		q := req.URL.Query()
		q.Set("userId", userID)
		if maxAge := strings.TrimSpace(ctx.Query("maxAgeMs")); maxAge != "" {
			q.Set("maxAgeMs", maxAge)
		}
		req.URL.RawQuery = q.Encode()
	}

	res, err := c.httpClient().Do(req)
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "kickoff_list_unavailable", "message": err.Error()})
		return
	}
	defer res.Body.Close()

	body, _ := io.ReadAll(res.Body)
	ctx.Data(res.StatusCode, "application/json; charset=utf-8", body)
}

// validateWorkspacePath proxies `GET /api/workspace/validate?path=...` to
// Clowder 3004. The upstream already validates the same way it does for
// `POST /api/threads`; this is a read-only preview so the im_web
// CoordinatorKickoffCard can show a friendly error before the user submits.
func (c *Clowder) validateWorkspacePath(ctx *wkhttp.Context) {
	if !c.config.IsConfigured() {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "clowder_bridge_not_configured"})
		return
	}
	endpoint := strings.TrimRight(c.config.APIBaseURL, "/") + "/api/workspace/validate"

	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, map[string]string{"error": "build_request_failed", "message": err.Error()})
		return
	}
	c.applyDirectoryUserHeader(req, ctx.GetLoginUID())
	if rawPath := strings.TrimSpace(ctx.Query("path")); rawPath != "" {
		q := req.URL.Query()
		q.Set("path", rawPath)
		req.URL.RawQuery = q.Encode()
	}

	res, err := c.httpClient().Do(req)
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "workspace_validate_unavailable", "message": err.Error()})
		return
	}
	defer res.Body.Close()

	body, _ := io.ReadAll(res.Body)
	ctx.Data(res.StatusCode, "application/json; charset=utf-8", body)
}

// proxyThreadTasks proxies `GET /api/threads/:threadId/tasks` (Phase 5) to
// Clowder 3004. Used by the im_web ProjectKanbanPanel.
func (c *Clowder) proxyThreadTasks(ctx *wkhttp.Context) {
	threadID := strings.TrimSpace(ctx.Param("threadId"))
	if threadID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "thread_id_required"})
		return
	}
	if !c.config.IsConfigured() {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "clowder_bridge_not_configured"})
		return
	}
	endpoint := strings.TrimRight(c.config.APIBaseURL, "/") +
		"/api/threads/" + url.PathEscape(threadID) + "/tasks"
	if rawQuery := strings.TrimSpace(ctx.Request.URL.RawQuery); rawQuery != "" {
		endpoint += "?" + rawQuery
	}

	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, map[string]string{"error": "build_request_failed", "message": err.Error()})
		return
	}
	c.applyDirectoryUserHeader(req, ctx.GetLoginUID())

	res, err := c.httpClient().Do(req)
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "thread_tasks_unavailable", "message": err.Error()})
		return
	}
	defer res.Body.Close()

	body, _ := io.ReadAll(res.Body)
	ctx.Data(res.StatusCode, "application/json; charset=utf-8", body)
}

// proxyThreadArtifacts proxies `GET /api/threads/:threadId/artifacts`
// (Phase 4.6) to Clowder 3004.
func (c *Clowder) proxyThreadArtifacts(ctx *wkhttp.Context) {
	threadID := strings.TrimSpace(ctx.Param("threadId"))
	if threadID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "thread_id_required"})
		return
	}
	if !c.config.IsConfigured() {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "clowder_bridge_not_configured"})
		return
	}
	endpoint := strings.TrimRight(c.config.APIBaseURL, "/") +
		"/api/threads/" + url.PathEscape(threadID) + "/artifacts"

	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, map[string]string{"error": "build_request_failed", "message": err.Error()})
		return
	}
	c.applyDirectoryUserHeader(req, ctx.GetLoginUID())

	res, err := c.httpClient().Do(req)
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "thread_artifacts_unavailable", "message": err.Error()})
		return
	}
	defer res.Body.Close()

	body, _ := io.ReadAll(res.Body)
	ctx.Data(res.StatusCode, "application/json; charset=utf-8", body)
}

// proxyPostThreadArtifact proxies `POST /api/threads/:threadId/artifacts`
// (Phase 4.5 declareArtifact) to Clowder 3004. The bridge forwards the
// caller's JSON body verbatim and adds the standard user header so the
// upstream can scope the operation.
func (c *Clowder) proxyPostThreadArtifact(ctx *wkhttp.Context) {
	threadID := strings.TrimSpace(ctx.Param("threadId"))
	if threadID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "thread_id_required"})
		return
	}
	if !c.config.IsConfigured() {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "clowder_bridge_not_configured"})
		return
	}
	body, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_body", "message": err.Error()})
		return
	}
	endpoint := strings.TrimRight(c.config.APIBaseURL, "/") +
		"/api/threads/" + url.PathEscape(threadID) + "/artifacts"

	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, map[string]string{"error": "build_request_failed", "message": err.Error()})
		return
	}
	req.Header.Set("Content-Type", "application/json")
	c.applyDirectoryUserHeader(req, ctx.GetLoginUID())

	res, err := c.httpClient().Do(req)
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "thread_artifact_create_unavailable", "message": err.Error()})
		return
	}
	defer res.Body.Close()

	respBody, _ := io.ReadAll(res.Body)
	ctx.Data(res.StatusCode, "application/json; charset=utf-8", respBody)
}

// proxyThreadWorkspaces proxies `GET /api/threads/:threadId/workspaces`
// (V3-32 runtime workspace ledger) to Clowder 3004.
func (c *Clowder) proxyThreadWorkspaces(ctx *wkhttp.Context) {
	threadID := strings.TrimSpace(ctx.Param("threadId"))
	if threadID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "thread_id_required"})
		return
	}
	if !c.config.IsConfigured() {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "clowder_bridge_not_configured"})
		return
	}
	endpoint := strings.TrimRight(c.config.APIBaseURL, "/") +
		"/api/threads/" + url.PathEscape(threadID) + "/workspaces"

	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, map[string]string{"error": "build_request_failed", "message": err.Error()})
		return
	}
	c.applyDirectoryUserHeader(req, ctx.GetLoginUID())

	res, err := c.httpClient().Do(req)
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "thread_workspaces_unavailable", "message": err.Error()})
		return
	}
	defer res.Body.Close()

	body, _ := io.ReadAll(res.Body)
	ctx.Data(res.StatusCode, "application/json; charset=utf-8", body)
}

func (c *Clowder) proxyToClowder(ctx *wkhttp.Context, method string, upstreamPath string, body io.Reader, unavailableCode string) {
	if !c.config.IsConfigured() {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "clowder_bridge_not_configured"})
		return
	}
	endpoint := strings.TrimRight(c.config.APIBaseURL, "/") + upstreamPath
	if method == http.MethodGet {
		if rawQuery := strings.TrimSpace(ctx.Request.URL.RawQuery); rawQuery != "" {
			endpoint += "?" + rawQuery
		}
	}
	req, err := http.NewRequest(method, endpoint, body)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, map[string]string{"error": "build_request_failed", "message": err.Error()})
		return
	}
	if method != http.MethodGet {
		req.Header.Set("Content-Type", "application/json")
	}
	c.applyDirectoryUserHeader(req, ctx.GetLoginUID())

	res, err := c.httpClient().Do(req)
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": unavailableCode, "message": err.Error()})
		return
	}
	defer res.Body.Close()

	respBody, _ := io.ReadAll(res.Body)
	ctx.Data(res.StatusCode, "application/json; charset=utf-8", respBody)
}

func (c *Clowder) readJSONBody(ctx *wkhttp.Context) ([]byte, bool) {
	body, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_body", "message": err.Error()})
		return nil, false
	}
	return body, true
}

func (c *Clowder) proxyMaomiWorkspaceRoot(ctx *wkhttp.Context) {
	c.proxyToClowder(ctx, http.MethodGet, "/api/maomi-workspaces/root", nil, "maomi_workspace_root_unavailable")
}

func (c *Clowder) proxyPostMaomiWorkspacePropose(ctx *wkhttp.Context) {
	body, ok := c.readJSONBody(ctx)
	if !ok {
		return
	}
	c.proxyToClowder(ctx, http.MethodPost, "/api/maomi-workspaces/propose", bytes.NewReader(body), "maomi_workspace_propose_unavailable")
}

func (c *Clowder) proxyPostMaomiWorkspace(ctx *wkhttp.Context) {
	body, ok := c.readJSONBody(ctx)
	if !ok {
		return
	}
	c.proxyToClowder(ctx, http.MethodPost, "/api/maomi-workspaces", bytes.NewReader(body), "maomi_workspace_create_unavailable")
}

func (c *Clowder) proxyListMaomiWorkspaces(ctx *wkhttp.Context) {
	c.proxyToClowder(ctx, http.MethodGet, "/api/maomi-workspaces", nil, "maomi_workspace_list_unavailable")
}

func (c *Clowder) proxyGetMaomiWorkspace(ctx *wkhttp.Context) {
	workspaceID := strings.TrimSpace(ctx.Param("workspaceId"))
	if workspaceID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "workspace_id_required"})
		return
	}
	c.proxyToClowder(ctx, http.MethodGet, "/api/maomi-workspaces/"+url.PathEscape(workspaceID), nil, "maomi_workspace_get_unavailable")
}

func (c *Clowder) proxyArchiveMaomiWorkspace(ctx *wkhttp.Context) {
	workspaceID := strings.TrimSpace(ctx.Param("workspaceId"))
	if workspaceID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "workspace_id_required"})
		return
	}
	c.proxyToClowder(ctx, http.MethodPost, "/api/maomi-workspaces/"+url.PathEscape(workspaceID)+"/archive", nil, "maomi_workspace_archive_unavailable")
}

func (c *Clowder) proxyCreateCoordination(ctx *wkhttp.Context) {
	body, ok := c.readJSONBody(ctx)
	if !ok {
		return
	}
	c.proxyToClowder(ctx, http.MethodPost, "/api/coordinator/coordination", bytes.NewReader(body), "coordination_create_unavailable")
}

func (c *Clowder) proxyGetCoordination(ctx *wkhttp.Context) {
	coordinationID := strings.TrimSpace(ctx.Param("coordinationId"))
	if coordinationID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "coordination_id_required"})
		return
	}
	c.proxyToClowder(ctx, http.MethodGet, "/api/coordinator/coordination/"+url.PathEscape(coordinationID), nil, "coordination_unavailable")
}

func (c *Clowder) proxyPatchCoordination(ctx *wkhttp.Context) {
	coordinationID := strings.TrimSpace(ctx.Param("coordinationId"))
	if coordinationID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "coordination_id_required"})
		return
	}
	body, ok := c.readJSONBody(ctx)
	if !ok {
		return
	}
	c.proxyToClowder(ctx, http.MethodPatch, "/api/coordinator/coordination/"+url.PathEscape(coordinationID), bytes.NewReader(body), "coordination_update_unavailable")
}

func (c *Clowder) proxyCancelCoordination(ctx *wkhttp.Context) {
	coordinationID := strings.TrimSpace(ctx.Param("coordinationId"))
	if coordinationID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "coordination_id_required"})
		return
	}
	body, ok := c.readJSONBody(ctx)
	if !ok {
		return
	}
	c.proxyToClowder(ctx, http.MethodPost, "/api/coordinator/coordination/"+url.PathEscape(coordinationID)+"/cancel", bytes.NewReader(body), "coordination_cancel_unavailable")
}

func (c *Clowder) proxyThreadCoordinations(ctx *wkhttp.Context) {
	threadID := strings.TrimSpace(ctx.Param("threadId"))
	if threadID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "thread_id_required"})
		return
	}
	c.proxyToClowder(ctx, http.MethodGet, "/api/threads/"+url.PathEscape(threadID)+"/coordinations", nil, "thread_coordinations_unavailable")
}

func (c *Clowder) proxyGetThreadWorkspaceBinding(ctx *wkhttp.Context) {
	threadID := strings.TrimSpace(ctx.Param("threadId"))
	if threadID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "thread_id_required"})
		return
	}
	c.proxyToClowder(ctx, http.MethodGet, "/api/threads/"+url.PathEscape(threadID)+"/workspace-binding", nil, "thread_workspace_binding_unavailable")
}

func (c *Clowder) proxyPutThreadWorkspaceBinding(ctx *wkhttp.Context) {
	threadID := strings.TrimSpace(ctx.Param("threadId"))
	if threadID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "thread_id_required"})
		return
	}
	body, ok := c.readJSONBody(ctx)
	if !ok {
		return
	}
	c.proxyToClowder(ctx, http.MethodPut, "/api/threads/"+url.PathEscape(threadID)+"/workspace-binding", bytes.NewReader(body), "thread_workspace_binding_update_unavailable")
}

// proxyCreateThread proxies `POST /api/threads` to Clowder 3004. im_web's
// CoordinatorKickoffCard calls this through the bridge so a project group
// thread can be created from im_web without depending on the clowder-ai
// web UI. The result includes a thread.id which the front-end uses to
// navigate within im_web (not to the clowder-ai web /thread/:id page).
func (c *Clowder) proxyCreateThread(ctx *wkhttp.Context) {
	if !c.config.IsConfigured() {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "clowder_bridge_not_configured"})
		return
	}
	body, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_body", "message": err.Error()})
		return
	}
	endpoint := strings.TrimRight(c.config.APIBaseURL, "/") + "/api/threads"

	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, map[string]string{"error": "build_request_failed", "message": err.Error()})
		return
	}
	req.Header.Set("Content-Type", "application/json")
	c.applyDirectoryUserHeader(req, ctx.GetLoginUID())

	res, err := c.httpClient().Do(req)
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "thread_create_unavailable", "message": err.Error()})
		return
	}
	defer res.Body.Close()

	respBody, _ := io.ReadAll(res.Body)
	ctx.Data(res.StatusCode, "application/json; charset=utf-8", respBody)
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
	response, ok := catContactResponse(req.CatID, directory.Agents, "existing")
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
		if response, ok := catContactResponse(name, directory.Agents, "runtime-created"); ok {
			ctx.JSON(http.StatusOK, response)
			return
		}
		if response, ok := catContactResponse(alias, directory.Agents, "runtime-created"); ok {
			ctx.JSON(http.StatusOK, response)
			return
		}
	}
	ctx.JSON(http.StatusOK, fallbackCreatedCatResponse(req, alias))
}

func (c *Clowder) deleteCatContact(ctx *wkhttp.Context) {
	catID := strings.TrimSpace(ctx.Param("catId"))
	if catID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "cat_required"})
		return
	}
	statusCode, body, err := c.deleteCatFromUpstream(catID, ctx.GetLoginUID())
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "cat_delete_unavailable", "message": err.Error()})
		return
	}
	if statusCode >= 200 && statusCode < 300 {
		c.pruneGroupCatState(catID)
	}
	ctx.Data(statusCode, "application/json; charset=utf-8", body)
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
	autoReplyMode := normalizeGroupAutoReplyMode(req.AutoReplyMode, req.ProactiveReplies)
	response := groupCatSyncResponse{
		GroupID:          groupID,
		GroupName:        strings.TrimSpace(req.GroupName),
		CatIDs:           cleanStringList(req.CatIDs),
		Cats:             decorateGroupCats(req.Cats),
		Prompt:           strings.TrimSpace(req.Prompt),
		ProactiveReplies: autoReplyMode == "soft_mentions",
		AutoReplyMode:    autoReplyMode,
	}
	c.groupCatsMu.Lock()
	if c.groupCatState == nil {
		c.groupCatState = map[string]groupCatSyncResponse{}
	}
	c.groupCatState[groupID] = response
	c.groupCatsMu.Unlock()
	return response
}

func normalizeGroupAutoReplyMode(mode string, proactiveReplies bool) string {
	switch strings.TrimSpace(mode) {
	case "off", "mentions_only", "soft_mentions":
		return strings.TrimSpace(mode)
	default:
		if proactiveReplies {
			return "soft_mentions"
		}
		return "mentions_only"
	}
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

func (c *Clowder) deleteCatFromUpstream(catID string, userID string) (int, []byte, error) {
	if !c.config.IsConfigured() {
		return 0, nil, fmt.Errorf("clowder bridge is not configured")
	}
	trimmed := strings.TrimSpace(catID)
	if trimmed == "" {
		return 0, nil, fmt.Errorf("cat is required")
	}
	endpoint := strings.TrimRight(c.config.APIBaseURL, "/") + "/api/cats/" + url.PathEscape(trimmed)
	req, err := http.NewRequest(http.MethodDelete, endpoint, nil)
	if err != nil {
		return 0, nil, err
	}
	c.applyDirectoryUserHeader(req, userID)

	res, err := c.httpClient().Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	return res.StatusCode, body, nil
}

func (c *Clowder) fetchLocalAuthCapabilities(userID string) (int, []byte, error) {
	if !c.config.IsConfigured() {
		return 0, nil, fmt.Errorf("clowder bridge is not configured")
	}
	endpoint := strings.TrimRight(c.config.APIBaseURL, "/") + "/api/local-auth/capabilities"
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return 0, nil, err
	}
	c.applyDirectoryUserHeader(req, userID)

	res, err := c.httpClient().Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer res.Body.Close()
	body, readErr := io.ReadAll(res.Body)
	if readErr != nil {
		return 0, nil, readErr
	}
	return res.StatusCode, body, nil
}

func (c *Clowder) pruneGroupCatState(catID string) int {
	needle := normalizeCatLookup(catID)
	if needle == "" {
		return 0
	}
	affected := 0
	c.groupCatsMu.Lock()
	defer c.groupCatsMu.Unlock()
	for groupID, state := range c.groupCatState {
		nextIDs := make([]string, 0, len(state.CatIDs))
		removed := false
		for _, id := range state.CatIDs {
			if normalizeCatLookup(id) == needle {
				removed = true
				continue
			}
			nextIDs = append(nextIDs, id)
		}

		nextCats := make([]ClowderAgent, 0, len(state.Cats))
		for _, cat := range state.Cats {
			if normalizeCatLookup(cat.CatID) == needle {
				removed = true
				continue
			}
			nextCats = append(nextCats, cat)
		}

		if !removed {
			continue
		}
		state.CatIDs = nextIDs
		state.Cats = nextCats
		if len(nextIDs) == 0 && len(nextCats) == 0 {
			state.Prompt = ""
		}
		c.groupCatState[groupID] = state
		affected++
	}
	return affected
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
	threadID := strings.TrimSpace(response.ThreadID)
	if threadID == "" {
		directory, err := c.fetchAgentDirectory(req.ChannelID, req.ChannelType, ctx.GetLoginUID())
		if err != nil {
			ctx.JSON(http.StatusBadGateway, map[string]string{"error": "bind_lookup_failed", "message": err.Error()})
			return
		}
		threadID = strings.TrimSpace(directory.ThreadID)
	}
	if threadID == "" {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "bind_thread_missing"})
		return
	}
	ctx.JSON(http.StatusOK, IMConnectorBinding{
		ConnectorID:    ConnectorID,
		ExternalChatID: externalChatIDForUser(req.ChannelID, req.ChannelType, ctx.GetLoginUID()),
		ChannelID:      req.ChannelID,
		ChannelType:    req.ChannelType,
		ThreadID:       threadID,
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

// conversationDeploymentAction proxies structured deployment approvals from
// IM Web to Clowder. Deployment card clicks must not be downgraded to natural
// language chat messages because approvals need idempotency and audit fields.
func (c *Clowder) conversationDeploymentAction(ctx *wkhttp.Context) {
	if !c.config.IsConfigured() {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "clowder_bridge_not_configured"})
		return
	}
	body, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_body", "message": err.Error()})
		return
	}
	endpoint := strings.TrimRight(c.config.APIBaseURL, "/") + "/api/connectors/im-web/deployment-action"
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, map[string]string{"error": "build_request_failed", "message": err.Error()})
		return
	}
	req.Header.Set("Content-Type", "application/json")
	c.applyDirectoryUserHeader(req, ctx.GetLoginUID())

	res, err := c.httpClient().Do(req)
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "deployment_action_unavailable", "message": err.Error()})
		return
	}
	defer res.Body.Close()

	respBody, _ := io.ReadAll(res.Body)
	ctx.Data(res.StatusCode, "application/json; charset=utf-8", respBody)
}

func (c *Clowder) conversationDeploymentRequest(ctx *wkhttp.Context) {
	body, ok := c.readJSONBody(ctx)
	if !ok {
		return
	}
	c.proxyToClowder(ctx, http.MethodPost, "/api/connectors/im-web/deployment-requests", bytes.NewReader(body), "deployment_request_unavailable")
}

func (c *Clowder) conversationDeploymentRequestUpdate(ctx *wkhttp.Context) {
	deploymentRequestID := strings.TrimSpace(ctx.Param("deploymentRequestId"))
	if deploymentRequestID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "deployment_request_id_required"})
		return
	}
	body, ok := c.readJSONBody(ctx)
	if !ok {
		return
	}
	c.proxyToClowder(
		ctx,
		http.MethodPatch,
		"/api/connectors/im-web/deployment-requests/"+url.PathEscape(deploymentRequestID),
		bytes.NewReader(body),
		"deployment_request_update_unavailable",
	)
}

func (c *Clowder) conversationDeploymentRequestActive(ctx *wkhttp.Context) {
	c.proxyToClowder(ctx, http.MethodGet, "/api/connectors/im-web/deployment-requests/active", nil, "deployment_request_active_unavailable")
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
	c.applyDirectoryUserHeader(req, userID)

	res, err := c.httpClient().Do(req)
	if err != nil {
		return c.fallbackAgentDirectory(userID, err)
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return c.fallbackAgentDirectory(userID, fmt.Errorf("clowder agents failed: %s", res.Status))
	}

	var directory AgentDirectoryResponse
	if err := json.NewDecoder(res.Body).Decode(&directory); err != nil {
		return c.fallbackAgentDirectory(userID, err)
	}
	if directory.Agents == nil {
		directory.Agents = []ClowderAgent{}
	}
	if len(directory.Agents) == 0 {
		if fallback, fallbackErr := c.fetchTemplateCandidateDirectory(userID); fallbackErr == nil && len(fallback.Agents) > 0 {
			return fallback, nil
		}
	}
	return directory, nil
}

func (c *Clowder) fallbackAgentDirectory(userID string, cause error) (AgentDirectoryResponse, error) {
	fallback, fallbackErr := c.fetchTemplateCandidateDirectory(userID)
	if fallbackErr == nil && len(fallback.Agents) > 0 {
		return fallback, nil
	}
	if cause != nil {
		return AgentDirectoryResponse{}, cause
	}
	return fallback, fallbackErr
}

func (c *Clowder) fetchTemplateCandidateDirectory(userID string) (AgentDirectoryResponse, error) {
	templates, err := c.fetchCatTemplates(userID)
	if err != nil {
		return AgentDirectoryResponse{}, err
	}

	agents := make([]ClowderAgent, 0, len(templates))
	for _, template := range templates {
		if agent, ok := catTemplateCandidateAgent(template); ok {
			agents = append(agents, agent)
		}
	}
	return AgentDirectoryResponse{Agents: agents}, nil
}

func (c *Clowder) fetchCatTemplates(userID string) ([]catTemplate, error) {
	if !c.config.IsConfigured() {
		return nil, fmt.Errorf("clowder bridge is not configured")
	}
	endpoint, err := url.Parse(strings.TrimRight(c.config.APIBaseURL, "/") + "/api/cat-templates")
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, err
	}
	c.applyDirectoryUserHeader(req, userID)

	res, err := c.httpClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("clowder cat templates failed: %s", res.Status)
	}

	var response catTemplatesResponse
	if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
		return nil, err
	}
	return response.Templates, nil
}

func (c *Clowder) applyDirectoryUserHeader(req *http.Request, userID string) {
	directoryUserID := strings.TrimSpace(c.config.DefaultOwnerUserID)
	if directoryUserID == "" {
		directoryUserID = strings.TrimSpace(userID)
	}
	if directoryUserID != "" {
		req.Header.Set("x-cat-cafe-user", directoryUserID)
	}
}

func catTemplateCandidateAgent(template catTemplate) (ClowderAgent, bool) {
	catID := strings.TrimSpace(template.ID)
	if catID == "" {
		return ClowderAgent{}, false
	}
	displayName := strings.TrimSpace(template.Name)
	if displayName == "" {
		displayName = catID
	}
	mentionPatterns := templateCandidateMentions(catID, displayName, template.Nickname)
	capabilitySummary := strings.TrimSpace(template.TeamStrengths)
	if capabilitySummary == "" {
		capabilitySummary = strings.TrimSpace(template.RoleDescription)
	}
	return ClowderAgent{
		CatID:              catID,
		DisplayName:        displayName,
		Aliases:            mentionPatterns,
		MentionPatterns:    mentionPatterns,
		Avatar:             strings.TrimSpace(template.Avatar),
		PersonalitySummary: strings.TrimSpace(template.Personality),
		CapabilitySummary:  capabilitySummary,
		Available:          false,
		AvailabilityState:  "unavailable",
		Source:             "disconnected",
		Connected:          false,
	}, true
}

func catRoleTemplateCandidate(template catTemplate) (ClowderCatTemplate, bool) {
	agent, ok := catTemplateCandidateAgent(template)
	if !ok {
		return ClowderCatTemplate{}, false
	}
	return ClowderCatTemplate{
		RoleTemplateID:     agent.CatID,
		CatID:              agent.CatID,
		DisplayName:        agent.DisplayName,
		Aliases:            agent.Aliases,
		MentionPatterns:    agent.MentionPatterns,
		Avatar:             agent.Avatar,
		PersonalitySummary: agent.PersonalitySummary,
		CapabilitySummary:  agent.CapabilitySummary,
		Cloneable:          true,
		Source:             "role-template",
	}, true
}

func catRoleTemplatesFromTemplates(templates []catTemplate) []ClowderCatTemplate {
	result := make([]ClowderCatTemplate, 0, len(templates))
	seen := map[string]bool{}
	for _, template := range templates {
		candidate, ok := catRoleTemplateCandidate(template)
		if !ok {
			continue
		}
		key := strings.ToLower(candidate.RoleTemplateID)
		if seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, candidate)
	}
	return result
}

func catRoleTemplateFromAgent(agent ClowderAgent) (ClowderCatTemplate, bool) {
	catID := strings.TrimSpace(agent.CatID)
	if catID == "" {
		return ClowderCatTemplate{}, false
	}
	displayName := strings.TrimSpace(agent.DisplayName)
	if displayName == "" {
		displayName = catID
	}
	return ClowderCatTemplate{
		RoleTemplateID:     catID,
		CatID:              catID,
		DisplayName:        displayName,
		Aliases:            agent.Aliases,
		MentionPatterns:    agent.MentionPatterns,
		Avatar:             agent.Avatar,
		PersonalitySummary: agent.PersonalitySummary,
		CapabilitySummary:  agent.CapabilitySummary,
		Cloneable:          true,
		Source:             "role-template",
	}, true
}

func catRoleTemplatesFromFallbackAgents(agents []ClowderAgent) []ClowderCatTemplate {
	result := make([]ClowderCatTemplate, 0, len(agents))
	seen := map[string]bool{}
	for _, agent := range agents {
		if agent.Source != "disconnected" {
			return []ClowderCatTemplate{}
		}
		candidate, ok := catRoleTemplateFromAgent(agent)
		if !ok {
			continue
		}
		key := strings.ToLower(candidate.RoleTemplateID)
		if seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, candidate)
	}
	return result
}

func templateCandidateMentions(values ...string) []string {
	mentions := make([]string, 0, len(values))
	seen := map[string]bool{}
	for _, value := range values {
		trimmed := strings.TrimPrefix(strings.TrimSpace(value), "@")
		if trimmed == "" {
			continue
		}
		mention := "@" + trimmed
		key := strings.ToLower(mention)
		if seen[key] {
			continue
		}
		seen[key] = true
		mentions = append(mentions, mention)
	}
	return mentions
}

func (c *Clowder) fetchCatDirectory(userID string) (CatDirectoryResponse, error) {
	directory, err := c.fetchAgentDirectory(clowderAIDirectChannelID, 1, userID)
	if err != nil {
		return CatDirectoryResponse{}, err
	}
	for idx := range directory.Agents {
		directory.Agents[idx] = decorateCatDirectoryContact(directory.Agents[idx])
	}
	templates := catRoleTemplatesFromFallbackAgents(directory.Agents)
	if len(templates) == 0 {
		rawTemplates, templateErr := c.fetchCatTemplates(userID)
		if templateErr == nil {
			templates = catRoleTemplatesFromTemplates(rawTemplates)
		}
	}
	return CatDirectoryResponse{
		Agents:    directory.Agents,
		Templates: templates,
	}, nil
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

func catContactResponse(catID string, agents []ClowderAgent, source string) (catContactEnvelope, bool) {
	needle := strings.TrimSpace(catID)
	if needle == "" {
		return catContactEnvelope{}, false
	}
	normalizedNeedle := normalizeCatLookup(needle)
	for _, agent := range agents {
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
	if !agent.Connected {
		agent.Connected = agent.Available && agent.Source != "disconnected" && agent.Source != "stale"
	}
	return agent
}

func decorateCatDirectoryContact(agent ClowderAgent) ClowderAgent {
	agent = decorateCatContact(agent, "existing")
	if agent.Source == "disconnected" {
		agent.Available = true
		agent.AvailabilityState = "available"
		agent.Connected = false
	}
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
	authType := normalizeCatAuthType(req.AuthType)
	accountRef := strings.TrimSpace(req.AccountRef)
	if authType == "" || accountRef == "" {
		return "", false
	}
	alias := normalizeCatAlias(req.Alias, name)
	command := "/cats new " + name + " " + alias + " --platform " + platform + " --auth " + authType + " --account " + accountRef
	if model := strings.TrimSpace(req.DefaultModel); model != "" {
		command += " --model " + model
	}
	if roleTemplateID := strings.TrimSpace(req.RoleTemplateID); roleTemplateID != "" {
		command += " --role-template " + roleTemplateID
	}
	return command, true
}

func normalizeCatAuthType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "oauth", "subscription":
		return "oauth"
	case "api_key", "api-key", "apikey":
		return "api-key"
	default:
		return ""
	}
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
