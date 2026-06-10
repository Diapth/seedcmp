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
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	commonmodule "github.com/TangSengDaoDao/TangSengDaoDaoServer/modules/common"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/common"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/log"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/util"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/wkhttp"
)

type Clowder struct {
	ctx                  *config.Context
	groupCatsMu          sync.RWMutex
	groupCatState        map[string]groupCatSyncResponse
	createdCatsMu        sync.RWMutex
	createdCatContacts   map[string]map[string]ClowderAgent
	projectGroupMu       sync.RWMutex
	projectGroupBindings map[string]ProjectGroupBinding
	skillMu              sync.RWMutex
	skillSources         map[string]ClowderSkillSource
	userSkills           map[string]map[string]ClowderUserSkill
	nextSkillSourceSeq   int64
	nextUserSkillSeq     int64
	log.Log
	config commonmodule.ClowderBridgeConfig
}

const clowderAIDirectChannelID = "clowder_ai"
const defaultPMMemberID = "clowder_cat:coordinator"

var errBindLookupFailed = errors.New("bind_lookup_failed")
var errBindThreadMissing = errors.New("bind_thread_missing")

func New(ctx *config.Context) *Clowder {
	return &Clowder{
		ctx:                  ctx,
		groupCatState:        map[string]groupCatSyncResponse{},
		createdCatContacts:   map[string]map[string]ClowderAgent{},
		projectGroupBindings: map[string]ProjectGroupBinding{},
		skillSources:         map[string]ClowderSkillSource{},
		userSkills:           map[string]map[string]ClowderUserSkill{},
		Log:                  log.NewTLog("clowder"),
		config:               commonmodule.ClowderBridgeConfigFromEnv(),
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
		auth.GET("/skills/summary", c.skillSummary)
		auth.GET("/skills", c.userSkillList)
		auth.GET("/skills/marketplace", c.skillMarketplace)
		auth.POST("/skills/upload", c.uploadSkillPackage)
		auth.POST("/skills/:sourceId/add", c.addMarketplaceSkill)
		auth.RouterGroup.PATCH("/skills/:userSkillId", auth.L.WKHttpHandler(c.updateUserSkill))
		auth.DELETE("/skills/:userSkillId", c.deleteUserSkill)
		auth.PUT("/skills/:userSkillId/assignments", c.updateUserSkillAssignments)
		auth.POST("/cats/connect", c.connectCatContact)
		auth.POST("/cats", c.createCatAndConnect)
		auth.DELETE("/cats/:catId", c.deleteCatContact)
		auth.POST("/group/cats/sync", c.syncGroupCats)
		auth.GET("/group/cats", c.groupCats)
		auth.POST("/project-groups/ensure", c.ensureProjectGroup)
		auth.GET("/project-groups/active", c.activeProjectGroup)
		auth.POST("/project-groups/:bindingId/thread", c.updateProjectGroupThread)
		auth.POST("/conversation/bind", c.bindConversation)
		auth.POST("/conversation/focus", c.setFocus)
		auth.POST("/conversation/focus/clear", c.clearFocus)
		auth.POST("/conversation/message", c.conversationMessage)
		auth.POST("/conversation/deployment-request", c.conversationDeploymentRequest)
		auth.RouterGroup.PATCH("/conversation/deployment-request/:deploymentRequestId", auth.L.WKHttpHandler(c.conversationDeploymentRequestUpdate))
		auth.GET("/conversation/deployment-request/active", c.conversationDeploymentRequestActive)
		auth.GET("/conversation/deployment-request/:deploymentRequestId", c.conversationDeploymentRequestDetail)
		auth.POST("/conversation/deployment-action", c.conversationDeploymentAction)
		auth.GET("/deployments/:deploymentId", c.proxyGetDeployment)
		auth.GET("/deployments/:deploymentId/logs", c.proxyGetDeploymentLogs)
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
		auth.GET("/workspace/file", c.proxyWorkspaceFile)
		auth.GET("/workspace/file/raw", c.proxyWorkspaceFileRaw)
		// Phase 4.5 + 5.2: thread tasks + artifacts REST.
		// We don't know the threadId prefix here, so we proxy the
		// `/v1/clowder/thread/...` shape to `/api/threads/...` upstream.
		auth.GET("/thread/:threadId/tasks", c.proxyThreadTasks)
		auth.GET("/thread/:threadId/coordinations", c.proxyThreadCoordinations)
		auth.GET("/thread/:threadId/artifacts", c.proxyThreadArtifacts)
		auth.POST("/thread/:threadId/artifacts", c.proxyPostThreadArtifact)
		auth.GET("/thread/:threadId/manual-context-pins", c.proxyListManualContextPins)
		auth.POST("/thread/:threadId/manual-context-pins", c.proxyUpsertManualContextPin)
		auth.RouterGroup.PATCH("/thread/:threadId/manual-context-pins/source-status", auth.L.WKHttpHandler(c.proxyMarkManualContextPinSourceStatus))
		auth.DELETE("/thread/:threadId/manual-context-pins/:pinId", c.proxyRemoveManualContextPin)
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
	Agents         []ClowderAgent                  `json:"agents"`
	Templates      []ClowderCatTemplate            `json:"templates,omitempty"`
	ClientDefaults map[string]ClowderClientDefault `json:"clientDefaults,omitempty"`
	SkillCatalog   map[string][]ClowderSkill       `json:"skillCatalog,omitempty"`
}

type ClowderCatTemplate struct {
	RoleTemplateID     string   `json:"roleTemplateId"`
	CatID              string   `json:"catId"`
	DisplayName        string   `json:"displayName"`
	Nickname           string   `json:"nickname,omitempty"`
	Aliases            []string `json:"aliases,omitempty"`
	MentionPatterns    []string `json:"mentionPatterns,omitempty"`
	Avatar             string   `json:"avatar,omitempty"`
	RoleDescription    string   `json:"roleDescription,omitempty"`
	Personality        string   `json:"personality,omitempty"`
	TeamStrengths      string   `json:"teamStrengths,omitempty"`
	Restrictions       []string `json:"restrictions,omitempty"`
	PersonalitySummary string   `json:"personalitySummary,omitempty"`
	CapabilitySummary  string   `json:"capabilitySummary,omitempty"`
	Cloneable          bool     `json:"cloneable"`
	UnavailableReason  string   `json:"unavailableReason,omitempty"`
	Source             string   `json:"source,omitempty"`
}

type catTemplatesResponse struct {
	Templates      []catTemplate                   `json:"templates"`
	ClientDefaults map[string]ClowderClientDefault `json:"clientDefaults,omitempty"`
	SkillCatalog   map[string][]ClowderSkill       `json:"skillCatalog,omitempty"`
}

type ClowderClientDefault struct {
	DefaultModel string   `json:"defaultModel,omitempty"`
	Models       []string `json:"models,omitempty"`
}

type ClowderSkill struct {
	Name        string                      `json:"name"`
	Category    string                      `json:"category,omitempty"`
	Trigger     string                      `json:"trigger,omitempty"`
	Description string                      `json:"description,omitempty"`
	Mounted     bool                        `json:"mounted"`
	RequiresMCP []ClowderSkillMCPDependency `json:"requiresMcp,omitempty"`
}

type ClowderSkillMCPDependency struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

type catTemplate struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	Nickname        string   `json:"nickname,omitempty"`
	Avatar          string   `json:"avatar,omitempty"`
	RoleDescription string   `json:"roleDescription,omitempty"`
	Personality     string   `json:"personality,omitempty"`
	TeamStrengths   string   `json:"teamStrengths,omitempty"`
	Restrictions    []string `json:"restrictions,omitempty"`
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
	Agent    ClowderAgent        `json:"agent"`
	ThreadID string              `json:"threadId,omitempty"`
	Binding  *IMConnectorBinding `json:"binding,omitempty"`
	Contact  struct {
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
	ProjectThreadID  string         `json:"projectThreadId,omitempty"`
	ProjectBindingID string         `json:"projectBindingId,omitempty"`
}

type groupCatSyncResponse struct {
	GroupID          string         `json:"groupId"`
	GroupName        string         `json:"groupName"`
	CatIDs           []string       `json:"catIds"`
	Cats             []ClowderAgent `json:"cats"`
	Prompt           string         `json:"prompt"`
	ProactiveReplies bool           `json:"proactiveReplies,omitempty"`
	AutoReplyMode    string         `json:"autoReplyMode,omitempty"`
	ProjectThreadID  string         `json:"projectThreadId,omitempty"`
	ProjectBindingID string         `json:"projectBindingId,omitempty"`
}

type projectGroupEnsureRequest struct {
	ProjectName         string   `json:"projectName"`
	WorkspaceID         string   `json:"workspaceId,omitempty"`
	PMDirectChannelID   string   `json:"pmDirectChannelId"`
	PMDirectChannelType uint8    `json:"pmDirectChannelType"`
	PMDirectThreadID    string   `json:"pmDirectThreadId,omitempty"`
	ProjectThreadID     string   `json:"projectThreadId,omitempty"`
	PMMemberID          string   `json:"pmMemberId,omitempty"`
	PMDisplayName       string   `json:"pmDisplayName,omitempty"`
	UserMemberIDs       []string `json:"userMemberIds,omitempty"`
	CatMemberIDs        []string `json:"catMemberIds,omitempty"`
	CreatedBy           string   `json:"createdBy,omitempty"`
}

type projectGroupThreadUpdateRequest struct {
	ProjectThreadID string `json:"projectThreadId"`
}

type ProjectGroupBinding struct {
	ID                  string   `json:"id"`
	UserID              string   `json:"userId"`
	ProjectName         string   `json:"projectName"`
	WorkspaceID         string   `json:"workspaceId,omitempty"`
	PMDirectChannelID   string   `json:"pmDirectChannelId"`
	PMDirectChannelType uint8    `json:"pmDirectChannelType"`
	PMDirectThreadID    string   `json:"pmDirectThreadId,omitempty"`
	ProjectGroupNo      string   `json:"projectGroupNo"`
	ProjectThreadID     string   `json:"projectThreadId,omitempty"`
	PMMemberID          string   `json:"pmMemberId"`
	UserMemberIDs       []string `json:"userMemberIds"`
	CatMemberIDs        []string `json:"catMemberIds"`
	CreatedBy           string   `json:"createdBy"`
	CreatedAt           int64    `json:"createdAt"`
	UpdatedAt           int64    `json:"updatedAt"`
	Status              string   `json:"status"`
}

type projectGroupEnsureResponse struct {
	Binding ProjectGroupBinding    `json:"binding"`
	Group   map[string]interface{} `json:"group"`
	Reused  bool                   `json:"reused"`
}

type projectGroupBindingResponse struct {
	Binding ProjectGroupBinding `json:"binding"`
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

func (c *Clowder) proxyWorkspaceFile(ctx *wkhttp.Context) {
	c.proxyToClowder(ctx, http.MethodGet, "/api/workspace/file", nil, "workspace_file_unavailable")
}

func (c *Clowder) proxyWorkspaceFileRaw(ctx *wkhttp.Context) {
	if !c.config.IsConfigured() {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "clowder_bridge_not_configured"})
		return
	}
	endpoint := strings.TrimRight(c.config.APIBaseURL, "/") + "/api/workspace/file/raw"
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
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "workspace_file_raw_unavailable", "message": err.Error()})
		return
	}
	defer res.Body.Close()

	contentType := strings.TrimSpace(res.Header.Get("Content-Type"))
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	if cacheControl := strings.TrimSpace(res.Header.Get("Cache-Control")); cacheControl != "" {
		ctx.Header("Cache-Control", cacheControl)
	}
	if disposition := strings.TrimSpace(res.Header.Get("Content-Disposition")); disposition != "" {
		ctx.Header("Content-Disposition", disposition)
	}
	body, _ := io.ReadAll(res.Body)
	ctx.Data(res.StatusCode, contentType, body)
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

func (c *Clowder) proxyListManualContextPins(ctx *wkhttp.Context) {
	threadID := strings.TrimSpace(ctx.Param("threadId"))
	if threadID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "thread_id_required"})
		return
	}
	c.proxyToClowder(ctx, http.MethodGet, "/api/threads/"+url.PathEscape(threadID)+"/manual-context-pins", nil, "manual_context_pins_unavailable")
}

func (c *Clowder) proxyUpsertManualContextPin(ctx *wkhttp.Context) {
	threadID := strings.TrimSpace(ctx.Param("threadId"))
	if threadID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "thread_id_required"})
		return
	}
	body, ok := c.readJSONBody(ctx)
	if !ok {
		return
	}
	c.proxyToClowder(ctx, http.MethodPost, "/api/threads/"+url.PathEscape(threadID)+"/manual-context-pins", bytes.NewReader(body), "manual_context_pin_upsert_unavailable")
}

func (c *Clowder) proxyMarkManualContextPinSourceStatus(ctx *wkhttp.Context) {
	threadID := strings.TrimSpace(ctx.Param("threadId"))
	if threadID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "thread_id_required"})
		return
	}
	body, ok := c.readJSONBody(ctx)
	if !ok {
		return
	}
	c.proxyToClowder(ctx, http.MethodPatch, "/api/threads/"+url.PathEscape(threadID)+"/manual-context-pins/source-status", bytes.NewReader(body), "manual_context_pin_source_status_unavailable")
}

func (c *Clowder) proxyRemoveManualContextPin(ctx *wkhttp.Context) {
	threadID := strings.TrimSpace(ctx.Param("threadId"))
	pinID := strings.TrimSpace(ctx.Param("pinId"))
	if threadID == "" || pinID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "thread_id_and_pin_id_required"})
		return
	}
	c.proxyToClowder(ctx, http.MethodDelete, "/api/threads/"+url.PathEscape(threadID)+"/manual-context-pins/"+url.PathEscape(pinID), nil, "manual_context_pin_remove_unavailable")
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
	if _, ok := buildCreateCatCommand(req); !ok {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "platform_required"})
		return
	}
	alias := normalizeCatAlias(req.Alias, name)
	agent, err := c.createCatViaUpstream(req, alias, ctx.GetLoginUID())
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "cat_create_failed", "message": err.Error()})
		return
	}
	response := catEnvelope(decorateCatContact(agent, "runtime-created"), "runtime-created")
	response, err = c.attachDirectThreadToCatContact(ctx.GetLoginUID(), name, response)
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "cat_thread_bind_failed", "message": err.Error()})
		return
	}
	c.storeCreatedCatContact(ctx.GetLoginUID(), response.Agent)
	ctx.JSON(http.StatusOK, response)
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
		c.pruneCreatedCatContact(ctx.GetLoginUID(), catID)
		if err := c.cleanupDeletedCatDirectConversation(ctx.GetLoginUID(), catID); err != nil {
			c.Warn(fmt.Sprintf("cleanup deleted clowder cat direct conversation failed: %v", err))
		}
	}
	ctx.Data(statusCode, "application/json; charset=utf-8", body)
}

func (c *Clowder) cleanupDeletedCatDirectConversation(userID string, catID string) error {
	if c == nil || c.ctx == nil {
		return nil
	}
	uid := strings.TrimSpace(userID)
	channelID := clowderCatDirectChannelID(catID)
	if uid == "" || channelID == "" {
		return nil
	}
	return c.ctx.IMDeleteConversation(config.DeleteConversationReq{
		UID:         uid,
		ChannelID:   channelID,
		ChannelType: common.ChannelTypePerson.Uint8(),
	})
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

func (c *Clowder) ensureProjectGroup(ctx *wkhttp.Context) {
	var req projectGroupEnsureRequest
	if err := ctx.BindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_body"})
		return
	}
	userID := strings.TrimSpace(ctx.GetLoginUID())
	if userID == "" {
		ctx.JSON(http.StatusUnauthorized, map[string]string{"error": "login_required"})
		return
	}
	if c.ctx == nil {
		ctx.JSON(http.StatusServiceUnavailable, map[string]string{"error": "im_context_unavailable"})
		return
	}
	projectName := normalizeProjectGroupName(req.ProjectName)
	pmChannelID := strings.TrimSpace(req.PMDirectChannelID)
	if pmChannelID == "" || req.PMDirectChannelType == 0 {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "pm_direct_channel_required"})
		return
	}
	pmMemberID := strings.TrimSpace(req.PMMemberID)
	if pmMemberID == "" {
		pmMemberID = defaultPMMemberID
	}
	pmDisplayName := strings.TrimSpace(req.PMDisplayName)
	if pmDisplayName == "" {
		pmDisplayName = "PM / 协调者"
	}
	key := projectGroupBindingKey(userID, pmChannelID, req.PMDirectChannelType, projectName)

	c.projectGroupMu.Lock()
	defer c.projectGroupMu.Unlock()
	if c.projectGroupBindings == nil {
		c.projectGroupBindings = map[string]ProjectGroupBinding{}
	}
	if binding, ok := c.projectGroupBindings[key]; ok && binding.Status == "active" {
		binding.UpdatedAt = time.Now().UnixMilli()
		if req.ProjectThreadID != "" {
			binding.ProjectThreadID = strings.TrimSpace(req.ProjectThreadID)
		}
		binding = projectGroupBindingWithInheritedThread(binding)
		binding.UserMemberIDs = projectGroupRequiredMemberUIDsForBinding(userID, pmMemberID, binding.UserMemberIDs, req.UserMemberIDs)
		binding.CatMemberIDs = cleanStringList(append(binding.CatMemberIDs, req.CatMemberIDs...))
		c.projectGroupBindings[key] = binding
		_ = c.ensureVirtualClowderUser(pmMemberID, pmDisplayName)
		_ = c.ensureProjectGroupMembers(binding.ProjectGroupNo, userID, pmMemberID, binding.UserMemberIDs)
		_ = c.sendProjectGroupHandoff(userID, req, binding, true)
		ctx.JSON(http.StatusOK, projectGroupEnsureResponse{
			Binding: binding,
			Group:   projectGroupResponse(binding.ProjectGroupNo, binding.ProjectName, userID),
			Reused:  true,
		})
		return
	}

	if err := c.ensureVirtualClowderUser(pmMemberID, pmDisplayName); err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "pm_member_prepare_failed", "message": err.Error()})
		return
	}

	requiredMemberIDs := projectGroupRequiredMemberUIDs(userID, pmMemberID, req.UserMemberIDs)
	groupNo, reused, err := c.findOrCreateProjectGroup(projectName, userID, pmMemberID, requiredMemberIDs)
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "project_group_create_failed", "message": err.Error()})
		return
	}

	now := time.Now().UnixMilli()
	binding := ProjectGroupBinding{
		ID:                  util.GenerUUID(),
		UserID:              userID,
		ProjectName:         projectName,
		WorkspaceID:         strings.TrimSpace(req.WorkspaceID),
		PMDirectChannelID:   pmChannelID,
		PMDirectChannelType: req.PMDirectChannelType,
		PMDirectThreadID:    strings.TrimSpace(req.PMDirectThreadID),
		ProjectGroupNo:      groupNo,
		ProjectThreadID:     strings.TrimSpace(req.ProjectThreadID),
		PMMemberID:          pmMemberID,
		UserMemberIDs:       requiredMemberIDs,
		CatMemberIDs:        cleanStringList(req.CatMemberIDs),
		CreatedBy:           "pm",
		CreatedAt:           now,
		UpdatedAt:           now,
		Status:              "active",
	}
	if strings.TrimSpace(req.CreatedBy) != "" {
		binding.CreatedBy = strings.TrimSpace(req.CreatedBy)
	}
	binding = projectGroupBindingWithInheritedThread(binding)
	c.projectGroupBindings[key] = binding
	_ = c.sendProjectGroupHandoff(userID, req, binding, reused)

	ctx.JSON(http.StatusOK, projectGroupEnsureResponse{
		Binding: binding,
		Group:   projectGroupResponse(groupNo, projectName, userID),
		Reused:  reused,
	})
}

func (c *Clowder) activeProjectGroup(ctx *wkhttp.Context) {
	userID := strings.TrimSpace(ctx.GetLoginUID())
	if userID == "" {
		ctx.JSON(http.StatusUnauthorized, map[string]string{"error": "login_required"})
		return
	}
	if projectGroupNo := strings.TrimSpace(ctx.Query("projectGroupNo")); projectGroupNo != "" {
		binding, ok := c.findActiveProjectGroupBindingByGroupNo(userID, projectGroupNo)
		if !ok {
			ctx.JSON(http.StatusNotFound, map[string]string{"error": "active_project_group_not_found"})
			return
		}
		ctx.JSON(http.StatusOK, projectGroupBindingResponse{Binding: binding})
		return
	}
	if projectGroupNo := strings.TrimSpace(ctx.Query("projectGroupId")); projectGroupNo != "" {
		binding, ok := c.findActiveProjectGroupBindingByGroupNo(userID, projectGroupNo)
		if !ok {
			ctx.JSON(http.StatusNotFound, map[string]string{"error": "active_project_group_not_found"})
			return
		}
		ctx.JSON(http.StatusOK, projectGroupBindingResponse{Binding: binding})
		return
	}
	pmChannelID := strings.TrimSpace(ctx.Query("pmDirectChannelId"))
	rawChannelType := strings.TrimSpace(ctx.Query("pmDirectChannelType"))
	if pmChannelID == "" || rawChannelType == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "pm_direct_channel_required"})
		return
	}
	parsedType, err := strconv.ParseUint(rawChannelType, 10, 8)
	if err != nil || parsedType == 0 {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "pm_direct_channel_required"})
		return
	}
	projectName := strings.TrimSpace(ctx.Query("projectName"))
	binding, ok := c.findActiveProjectGroupBinding(userID, pmChannelID, uint8(parsedType), projectName)
	if !ok {
		ctx.JSON(http.StatusNotFound, map[string]string{"error": "active_project_group_not_found"})
		return
	}
	ctx.JSON(http.StatusOK, projectGroupBindingResponse{Binding: binding})
}

func (c *Clowder) updateProjectGroupThread(ctx *wkhttp.Context) {
	userID := strings.TrimSpace(ctx.GetLoginUID())
	if userID == "" {
		ctx.JSON(http.StatusUnauthorized, map[string]string{"error": "login_required"})
		return
	}
	bindingID := strings.TrimSpace(ctx.Param("bindingId"))
	if bindingID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "binding_id_required"})
		return
	}
	var req projectGroupThreadUpdateRequest
	if err := ctx.BindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_body"})
		return
	}
	threadID := strings.TrimSpace(req.ProjectThreadID)
	if threadID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "project_thread_id_required"})
		return
	}
	binding, ok := c.updateProjectGroupBindingThread(bindingID, userID, threadID)
	if !ok {
		ctx.JSON(http.StatusNotFound, map[string]string{"error": "project_group_binding_not_found"})
		return
	}
	ctx.JSON(http.StatusOK, projectGroupBindingResponse{Binding: binding})
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
		ProjectThreadID:  strings.TrimSpace(req.ProjectThreadID),
		ProjectBindingID: strings.TrimSpace(req.ProjectBindingID),
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

func createdCatOwnerKey(userID string) string {
	trimmed := strings.TrimSpace(userID)
	if trimmed == "" {
		return "default"
	}
	return trimmed
}

func (c *Clowder) storeCreatedCatContact(userID string, agent ClowderAgent) ClowderAgent {
	agent = decorateCatContact(agent, "runtime-created")
	catID := strings.TrimSpace(agent.CatID)
	if catID == "" {
		return agent
	}
	agent.LastActiveAt = time.Now().UnixMilli()
	ownerKey := createdCatOwnerKey(userID)
	c.createdCatsMu.Lock()
	defer c.createdCatsMu.Unlock()
	if c.createdCatContacts == nil {
		c.createdCatContacts = map[string]map[string]ClowderAgent{}
	}
	if c.createdCatContacts[ownerKey] == nil {
		c.createdCatContacts[ownerKey] = map[string]ClowderAgent{}
	}
	c.createdCatContacts[ownerKey][normalizeCatLookup(catID)] = agent
	return agent
}

func (c *Clowder) loadCreatedCatContacts(userID string) []ClowderAgent {
	ownerKey := createdCatOwnerKey(userID)
	c.createdCatsMu.RLock()
	defer c.createdCatsMu.RUnlock()
	contacts := c.createdCatContacts[ownerKey]
	if len(contacts) == 0 {
		return nil
	}
	agents := make([]ClowderAgent, 0, len(contacts))
	for _, agent := range contacts {
		agents = append(agents, decorateCatContact(agent, "runtime-created"))
	}
	sort.SliceStable(agents, func(i, j int) bool {
		if agents[i].LastActiveAt != agents[j].LastActiveAt {
			return agents[i].LastActiveAt > agents[j].LastActiveAt
		}
		return strings.ToLower(agents[i].DisplayName) < strings.ToLower(agents[j].DisplayName)
	})
	return agents
}

func (c *Clowder) mergeCreatedCatContacts(userID string, agents []ClowderAgent) []ClowderAgent {
	created := c.loadCreatedCatContacts(userID)
	if len(created) == 0 {
		return agents
	}
	seen := map[string]bool{}
	for _, agent := range agents {
		if key := normalizeCatLookup(agent.CatID); key != "" {
			seen[key] = true
		}
	}
	merged := make([]ClowderAgent, 0, len(created)+len(agents))
	for _, agent := range created {
		key := normalizeCatLookup(agent.CatID)
		if key == "" || seen[key] {
			continue
		}
		seen[key] = true
		merged = append(merged, agent)
	}
	merged = append(merged, agents...)
	return merged
}

func (c *Clowder) pruneCreatedCatContact(userID string, catID string) bool {
	needle := normalizeCatLookup(catID)
	if needle == "" {
		return false
	}
	ownerKey := createdCatOwnerKey(userID)
	c.createdCatsMu.Lock()
	defer c.createdCatsMu.Unlock()
	contacts := c.createdCatContacts[ownerKey]
	if len(contacts) == 0 {
		return false
	}
	for key, agent := range contacts {
		if key == needle ||
			normalizeCatLookup(agent.DisplayName) == needle ||
			containsNormalized(agent.MentionPatterns, needle) ||
			containsNormalized(agent.Aliases, needle) {
			delete(contacts, key)
			return true
		}
	}
	return false
}

func normalizeProjectGroupName(value string) string {
	trimmed := strings.Trim(strings.TrimSpace(value), "「」『』“”\"'")
	if trimmed == "" {
		return "项目群聊"
	}
	runes := []rune(trimmed)
	if len(runes) > 20 {
		return string(runes[:20])
	}
	return trimmed
}

func projectGroupBindingKey(userID string, pmChannelID string, pmChannelType uint8, projectName string) string {
	return strings.ToLower(strings.Join([]string{
		strings.TrimSpace(userID),
		externalChatIDForUser(pmChannelID, pmChannelType, userID),
		normalizeProjectGroupName(projectName),
	}, "|"))
}

func projectGroupRequiredMemberUIDs(userID string, pmMemberID string, extraUserIDs []string) []string {
	return cleanStringList(append([]string{userID, pmMemberID}, extraUserIDs...))
}

func projectGroupRequiredMemberUIDsForBinding(userID string, pmMemberID string, existingUserIDs []string, requestUserIDs []string) []string {
	return projectGroupRequiredMemberUIDs(userID, pmMemberID, append(existingUserIDs, requestUserIDs...))
}

func projectGroupResponse(groupNo string, groupName string, owner string) map[string]interface{} {
	return map[string]interface{}{
		"group_no": groupNo,
		"name":     groupName,
		"owner":    owner,
		"creator":  owner,
		"status":   1,
		"role":     1,
	}
}

func projectGroupBindingWithInheritedThread(binding ProjectGroupBinding) ProjectGroupBinding {
	if strings.TrimSpace(binding.ProjectThreadID) == "" {
		binding.ProjectThreadID = strings.TrimSpace(binding.PMDirectThreadID)
	} else {
		binding.ProjectThreadID = strings.TrimSpace(binding.ProjectThreadID)
	}
	binding.PMDirectThreadID = strings.TrimSpace(binding.PMDirectThreadID)
	return binding
}

func (c *Clowder) findActiveProjectGroupBinding(userID string, pmChannelID string, pmChannelType uint8, projectName string) (ProjectGroupBinding, bool) {
	c.projectGroupMu.RLock()
	defer c.projectGroupMu.RUnlock()
	if c.projectGroupBindings == nil {
		return ProjectGroupBinding{}, false
	}
	trimmedUserID := strings.TrimSpace(userID)
	trimmedPMChannelID := strings.TrimSpace(pmChannelID)
	normalizedProjectName := normalizeProjectGroupName(projectName)
	hasProjectName := strings.TrimSpace(projectName) != ""
	var best ProjectGroupBinding
	for _, binding := range c.projectGroupBindings {
		if binding.Status != "active" {
			continue
		}
		if strings.TrimSpace(binding.UserID) != trimmedUserID {
			continue
		}
		if strings.TrimSpace(binding.PMDirectChannelID) != trimmedPMChannelID || binding.PMDirectChannelType != pmChannelType {
			continue
		}
		if hasProjectName && normalizeProjectGroupName(binding.ProjectName) != normalizedProjectName {
			continue
		}
		if best.ID == "" || binding.UpdatedAt > best.UpdatedAt {
			best = binding
		}
	}
	return best, best.ID != ""
}

func (c *Clowder) findActiveProjectGroupBindingByGroupNo(userID string, projectGroupNo string) (ProjectGroupBinding, bool) {
	c.projectGroupMu.RLock()
	defer c.projectGroupMu.RUnlock()
	if c.projectGroupBindings == nil {
		return ProjectGroupBinding{}, false
	}
	trimmedUserID := strings.TrimSpace(userID)
	trimmedGroupNo := strings.TrimSpace(projectGroupNo)
	if trimmedUserID == "" || trimmedGroupNo == "" {
		return ProjectGroupBinding{}, false
	}
	var best ProjectGroupBinding
	for _, binding := range c.projectGroupBindings {
		if binding.Status != "active" {
			continue
		}
		if strings.TrimSpace(binding.UserID) != trimmedUserID {
			continue
		}
		if strings.TrimSpace(binding.ProjectGroupNo) != trimmedGroupNo {
			continue
		}
		if best.ID == "" || binding.UpdatedAt > best.UpdatedAt {
			best = binding
		}
	}
	return best, best.ID != ""
}

func (c *Clowder) updateProjectGroupBindingThread(bindingID string, userID string, projectThreadID string) (ProjectGroupBinding, bool) {
	c.projectGroupMu.Lock()
	defer c.projectGroupMu.Unlock()
	if c.projectGroupBindings == nil {
		return ProjectGroupBinding{}, false
	}
	trimmedBindingID := strings.TrimSpace(bindingID)
	trimmedUserID := strings.TrimSpace(userID)
	trimmedThreadID := strings.TrimSpace(projectThreadID)
	for key, binding := range c.projectGroupBindings {
		if strings.TrimSpace(binding.ID) != trimmedBindingID || strings.TrimSpace(binding.UserID) != trimmedUserID {
			continue
		}
		binding.ProjectThreadID = trimmedThreadID
		binding.UpdatedAt = time.Now().UnixMilli()
		c.projectGroupBindings[key] = binding
		return binding, true
	}
	return ProjectGroupBinding{}, false
}

func (c *Clowder) findOrCreateProjectGroup(projectName string, userID string, pmMemberID string, memberUIDs []string) (string, bool, error) {
	if existing, ok, err := c.findExistingProjectGroup(projectName, userID); err != nil {
		return "", false, err
	} else if ok {
		if err := c.ensureProjectGroupMembers(existing, userID, pmMemberID, memberUIDs); err != nil {
			return "", true, err
		}
		return existing, true, nil
	}
	groupNo, err := c.createProjectGroup(projectName, userID, pmMemberID, memberUIDs)
	return groupNo, false, err
}

func (c *Clowder) findExistingProjectGroup(projectName string, userID string) (string, bool, error) {
	if c.ctx == nil {
		return "", false, fmt.Errorf("im context unavailable")
	}
	type row struct {
		GroupNo string `db:"group_no"`
	}
	rows := make([]row, 0, 1)
	_, err := c.ctx.DB().
		Select("g.group_no").
		From("`group` g").
		Join("group_member", "g.group_no=group_member.group_no").
		Where("g.name=? and g.status=1 and group_member.uid=? and group_member.is_deleted=0 and group_member.status=1", projectName, userID).
		Limit(1).
		Load(&rows)
	if err != nil {
		return "", false, err
	}
	if len(rows) == 0 || strings.TrimSpace(rows[0].GroupNo) == "" {
		return "", false, nil
	}
	return strings.TrimSpace(rows[0].GroupNo), true, nil
}

func (c *Clowder) createProjectGroup(projectName string, userID string, pmMemberID string, memberUIDs []string) (string, error) {
	if c.ctx == nil {
		return "", fmt.Errorf("im context unavailable")
	}
	groupNo := util.GenerUUID()
	version := c.ctx.GenSeq(common.GroupSeqKey)
	memberUIDs = projectGroupRequiredMemberUIDs(userID, pmMemberID, memberUIDs)

	tx, err := c.ctx.DB().Begin()
	if err != nil {
		return "", err
	}
	defer func() {
		if err := recover(); err != nil {
			tx.RollbackUnlessCommitted()
			panic(err)
		}
	}()

	_, err = tx.InsertBySql(
		"insert into `group` (group_no,name,creator,status,version,allow_view_history_msg) values(?,?,?,?,?,?)",
		groupNo,
		projectName,
		userID,
		1,
		version,
		int(common.GroupAllowViewHistoryMsgEnabled),
	).Exec()
	if err != nil {
		tx.RollbackUnlessCommitted()
		return "", err
	}

	for _, uid := range memberUIDs {
		memberVersion := c.ctx.GenSeq(common.GroupMemberSeqKey)
		role := 0
		robot := 0
		if uid == userID {
			role = 1
		} else if uid == pmMemberID {
			role = 2
			robot = 1
		}
		_, err = tx.InsertBySql(
			"insert into group_member (group_no,uid,role,version,status,vercode,robot,invite_uid) values(?,?,?,?,?,?,?,?)",
			groupNo,
			uid,
			role,
			memberVersion,
			int(common.GroupMemberStatusNormal),
			fmt.Sprintf("%s@%d", util.GenerUUID(), common.GroupMember),
			robot,
			userID,
		).Exec()
		if err != nil {
			tx.RollbackUnlessCommitted()
			return "", err
		}
	}

	if err := c.ctx.IMCreateOrUpdateChannel(&config.ChannelCreateReq{
		ChannelID:   groupNo,
		ChannelType: common.ChannelTypeGroup.Uint8(),
		Subscribers: memberUIDs,
	}); err != nil {
		tx.RollbackUnlessCommitted()
		return "", err
	}

	if err := tx.Commit(); err != nil {
		tx.RollbackUnlessCommitted()
		return "", err
	}
	return groupNo, nil
}

func (c *Clowder) ensureProjectGroupMembers(groupNo string, userID string, pmMemberID string, memberUIDs []string) error {
	memberUIDs = projectGroupRequiredMemberUIDs(userID, pmMemberID, memberUIDs)
	existing := make([]string, 0, len(memberUIDs))
	_, err := c.ctx.DB().
		Select("uid").
		From("group_member").
		Where("group_no=? and uid in ? and is_deleted=0 and status=1", groupNo, memberUIDs).
		Load(&existing)
	if err != nil {
		return err
	}
	existingSet := map[string]bool{}
	for _, uid := range existing {
		existingSet[strings.TrimSpace(uid)] = true
	}
	missing := make([]string, 0)
	for _, uid := range memberUIDs {
		if !existingSet[uid] {
			missing = append(missing, uid)
		}
	}
	if len(missing) == 0 {
		return nil
	}
	tx, err := c.ctx.DB().Begin()
	if err != nil {
		return err
	}
	for _, uid := range missing {
		role := 0
		robot := 0
		if uid == pmMemberID {
			role = 2
			robot = 1
		}
		_, err = tx.InsertBySql(
			"insert into group_member (group_no,uid,role,version,status,vercode,robot,invite_uid) values(?,?,?,?,?,?,?,?)",
			groupNo,
			uid,
			role,
			c.ctx.GenSeq(common.GroupMemberSeqKey),
			int(common.GroupMemberStatusNormal),
			fmt.Sprintf("%s@%d", util.GenerUUID(), common.GroupMember),
			robot,
			userID,
		).Exec()
		if err != nil {
			tx.RollbackUnlessCommitted()
			return err
		}
	}
	if err := c.ctx.IMAddSubscriber(&config.SubscriberAddReq{
		ChannelID:   groupNo,
		ChannelType: common.ChannelTypeGroup.Uint8(),
		Subscribers: missing,
	}); err != nil {
		tx.RollbackUnlessCommitted()
		return err
	}
	if err := tx.Commit(); err != nil {
		tx.RollbackUnlessCommitted()
		return err
	}
	return nil
}

func (c *Clowder) sendProjectGroupHandoff(userID string, req projectGroupEnsureRequest, binding ProjectGroupBinding, reused bool) error {
	if c.ctx == nil {
		return fmt.Errorf("im context unavailable")
	}
	verb := "已创建"
	if reused {
		verb = "会继续使用"
	}
	content := fmt.Sprintf("我%s项目群「%s」，你和相关猫猫都在里面。后续执行会在项目群里进行，我会在这里同步关键进度和等你反馈。", verb, binding.ProjectName)
	msgReq, err := BuildOutboundMessageWithDefaultRecipient(OutboundPayload{
		ConnectorID:    ConnectorID,
		ExternalChatID: externalChatIDForUser(req.PMDirectChannelID, req.PMDirectChannelType, userID),
		ThreadID:       binding.PMDirectThreadID,
		CatID:          "coordinator",
		CatDisplayName: "PM",
		Content:        content,
		Format:         "markdown",
		Metadata: map[string]interface{}{
			"project_group_no":   binding.ProjectGroupNo,
			"project_group_name": binding.ProjectName,
			"project_binding_id": binding.ID,
			"project_handoff":    true,
			"reused":             reused,
		},
	}, userID)
	if err != nil {
		return err
	}
	if isClowderVirtualSenderUID(msgReq.FromUID) {
		if err := c.ensureVirtualClowderUser(msgReq.FromUID, "PM"); err != nil {
			return err
		}
	}
	return c.ctx.SendMessage(msgReq)
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
	binding, err := c.ensureConversationBinding(req.ChannelID, req.ChannelType, ctx.GetLoginUID(), req.Title)
	if err != nil {
		code := "bind_failed"
		if errors.Is(err, errBindLookupFailed) {
			code = "bind_lookup_failed"
		} else if errors.Is(err, errBindThreadMissing) {
			code = "bind_thread_missing"
		}
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": code, "message": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, binding)
}

func (c *Clowder) ensureConversationBinding(channelID string, channelType uint8, userID string, title string) (IMConnectorBinding, error) {
	if strings.TrimSpace(channelID) == "" || channelType == 0 {
		return IMConnectorBinding{}, errors.New("channel_required")
	}
	text := "/new"
	if strings.TrimSpace(title) != "" {
		text = "/new " + strings.TrimSpace(title)
	}
	response, err := c.sendCommand(channelID, channelType, userID, text)
	if err != nil {
		return IMConnectorBinding{}, err
	}
	threadID := strings.TrimSpace(response.ThreadID)
	if threadID == "" {
		directory, err := c.fetchAgentDirectory(channelID, channelType, userID)
		if err != nil {
			return IMConnectorBinding{}, fmt.Errorf("%w: %v", errBindLookupFailed, err)
		}
		threadID = strings.TrimSpace(directory.ThreadID)
	}
	if threadID == "" {
		return IMConnectorBinding{}, errBindThreadMissing
	}
	return IMConnectorBinding{
		ConnectorID:    ConnectorID,
		ExternalChatID: externalChatIDForUser(channelID, channelType, userID),
		ChannelID:      channelID,
		ChannelType:    channelType,
		ThreadID:       threadID,
		UserID:         userID,
		Status:         BindingStatusActive,
	}, nil
}

func (c *Clowder) attachDirectThreadToCatContact(userID string, title string, response catContactEnvelope) (catContactEnvelope, error) {
	channelID := clowderCatDirectChannelID(response.Agent.CatID)
	if channelID == "" {
		return response, nil
	}
	binding, err := c.ensureConversationBinding(channelID, 1, userID, title)
	if err != nil {
		return response, err
	}
	response.ThreadID = binding.ThreadID
	response.Binding = &binding
	return response, nil
}

func clowderCatDirectChannelID(catID string) string {
	id := strings.TrimSpace(catID)
	if id == "" {
		return ""
	}
	if strings.HasPrefix(id, "clowder_cat:") {
		return id
	}
	return "clowder_cat:" + id
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
	msgReq, err := BuildInboundPersistMessage(req, ctx.GetLoginUID())
	if err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_message", "message": err.Error()})
		return
	}
	if err := c.ctx.SendMessage(msgReq); err != nil {
		c.Error("persist clowder inbound message failed")
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "persist_failed", "message": err.Error()})
		return
	}
	response, err := c.sendInboundTextWithRouting(req.ChannelID, req.ChannelType, ctx.GetLoginUID(), routeTextForCatRequest(req), req.DirectCatID, req.TargetCatIDs, req.PromptContext, req.ThreadID)
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

func (c *Clowder) conversationDeploymentRequestDetail(ctx *wkhttp.Context) {
	deploymentRequestID := strings.TrimSpace(ctx.Param("deploymentRequestId"))
	if deploymentRequestID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "deployment_request_id_required"})
		return
	}
	c.proxyToClowder(
		ctx,
		http.MethodGet,
		"/api/connectors/im-web/deployment-requests/"+url.PathEscape(deploymentRequestID),
		nil,
		"deployment_request_unavailable",
	)
}

func (c *Clowder) proxyGetDeployment(ctx *wkhttp.Context) {
	deploymentID := strings.TrimSpace(ctx.Param("deploymentId"))
	if deploymentID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "deployment_id_required"})
		return
	}
	c.proxyToClowder(ctx, http.MethodGet, "/api/deployments/"+url.PathEscape(deploymentID), nil, "deployment_unavailable")
}

func (c *Clowder) proxyGetDeploymentLogs(ctx *wkhttp.Context) {
	deploymentID := strings.TrimSpace(ctx.Param("deploymentId"))
	if deploymentID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "deployment_id_required"})
		return
	}
	c.proxyToClowder(ctx, http.MethodGet, "/api/deployments/"+url.PathEscape(deploymentID)+"/logs", nil, "deployment_logs_unavailable")
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
	directory, _, err := c.fetchAgentDirectoryWithTemplateResponse(channelID, channelType, userID)
	return directory, err
}

func (c *Clowder) fetchAgentDirectoryWithTemplateResponse(channelID string, channelType uint8, userID string) (AgentDirectoryResponse, *catTemplatesResponse, error) {
	if !c.config.IsConfigured() {
		return AgentDirectoryResponse{}, nil, fmt.Errorf("clowder bridge is not configured")
	}
	endpoint, err := url.Parse(strings.TrimRight(c.config.APIBaseURL, "/") + "/api/connectors/im-web/agents")
	if err != nil {
		return AgentDirectoryResponse{}, nil, err
	}
	query := endpoint.Query()
	query.Set("externalChatId", externalChatIDForUser(channelID, channelType, userID))
	endpoint.RawQuery = query.Encode()

	req, err := http.NewRequest(http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return AgentDirectoryResponse{}, nil, err
	}
	c.applyDirectoryUserHeader(req, userID)

	res, err := c.httpClient().Do(req)
	if err != nil {
		return c.fallbackAgentDirectoryWithTemplateResponse(userID, err)
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return c.fallbackAgentDirectoryWithTemplateResponse(userID, fmt.Errorf("clowder agents failed: %s", res.Status))
	}

	var directory AgentDirectoryResponse
	if err := json.NewDecoder(res.Body).Decode(&directory); err != nil {
		return c.fallbackAgentDirectoryWithTemplateResponse(userID, err)
	}
	if directory.Agents == nil {
		directory.Agents = []ClowderAgent{}
	}
	if len(directory.Agents) == 0 {
		if fallback, templateResponse, fallbackErr := c.fetchTemplateCandidateDirectoryWithResponse(userID); fallbackErr == nil && len(fallback.Agents) > 0 {
			return fallback, &templateResponse, nil
		}
	}
	return directory, nil, nil
}

func (c *Clowder) fallbackAgentDirectory(userID string, cause error) (AgentDirectoryResponse, error) {
	fallback, _, fallbackErr := c.fallbackAgentDirectoryWithTemplateResponse(userID, cause)
	return fallback, fallbackErr
}

func (c *Clowder) fallbackAgentDirectoryWithTemplateResponse(userID string, cause error) (AgentDirectoryResponse, *catTemplatesResponse, error) {
	fallback, templateResponse, fallbackErr := c.fetchTemplateCandidateDirectoryWithResponse(userID)
	if fallbackErr == nil && len(fallback.Agents) > 0 {
		return fallback, &templateResponse, nil
	}
	if cause != nil {
		return AgentDirectoryResponse{}, nil, cause
	}
	return fallback, nil, fallbackErr
}

func (c *Clowder) fetchTemplateCandidateDirectory(userID string) (AgentDirectoryResponse, error) {
	directory, _, err := c.fetchTemplateCandidateDirectoryWithResponse(userID)
	return directory, err
}

func (c *Clowder) fetchTemplateCandidateDirectoryWithResponse(userID string) (AgentDirectoryResponse, catTemplatesResponse, error) {
	templateResponse, err := c.fetchCatTemplates(userID)
	if err != nil {
		return AgentDirectoryResponse{}, catTemplatesResponse{}, err
	}

	agents := make([]ClowderAgent, 0, len(templateResponse.Templates))
	for _, template := range templateResponse.Templates {
		if agent, ok := catTemplateCandidateAgent(template); ok {
			agents = append(agents, agent)
		}
	}
	return AgentDirectoryResponse{Agents: agents}, templateResponse, nil
}

func (c *Clowder) fetchCatTemplates(userID string) (catTemplatesResponse, error) {
	if !c.config.IsConfigured() {
		return catTemplatesResponse{}, fmt.Errorf("clowder bridge is not configured")
	}
	endpoint, err := url.Parse(strings.TrimRight(c.config.APIBaseURL, "/") + "/api/cat-templates")
	if err != nil {
		return catTemplatesResponse{}, err
	}

	req, err := http.NewRequest(http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return catTemplatesResponse{}, err
	}
	c.applyDirectoryUserHeader(req, userID)

	res, err := c.httpClient().Do(req)
	if err != nil {
		return catTemplatesResponse{}, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return catTemplatesResponse{}, fmt.Errorf("clowder cat templates failed: %s", res.Status)
	}

	var response catTemplatesResponse
	if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
		return catTemplatesResponse{}, err
	}
	if response.Templates == nil {
		response.Templates = []catTemplate{}
	}
	return response, nil
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
		Nickname:           strings.TrimSpace(template.Nickname),
		Aliases:            agent.Aliases,
		MentionPatterns:    agent.MentionPatterns,
		Avatar:             agent.Avatar,
		RoleDescription:    strings.TrimSpace(template.RoleDescription),
		Personality:        strings.TrimSpace(template.Personality),
		TeamStrengths:      strings.TrimSpace(template.TeamStrengths),
		Restrictions:       cleanStringList(template.Restrictions),
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
	directory, templateResponse, err := c.fetchAgentDirectoryWithTemplateResponse(clowderAIDirectChannelID, 1, userID)
	if err != nil {
		return CatDirectoryResponse{}, err
	}
	for idx := range directory.Agents {
		directory.Agents[idx] = decorateCatDirectoryContact(directory.Agents[idx])
	}
	directory.Agents = c.mergeCreatedCatContacts(userID, directory.Agents)
	if templateResponse == nil {
		rawTemplates, templateErr := c.fetchCatTemplates(userID)
		if templateErr == nil {
			templateResponse = &rawTemplates
		}
	}
	var templates []ClowderCatTemplate
	if templateResponse != nil {
		templates = catRoleTemplatesFromTemplates(templateResponse.Templates)
	}
	if len(templates) == 0 {
		templates = catRoleTemplatesFromFallbackAgents(directory.Agents)
	}
	clientDefaults := map[string]ClowderClientDefault(nil)
	skillCatalog := map[string][]ClowderSkill(nil)
	if templateResponse != nil {
		clientDefaults = templateResponse.ClientDefaults
		skillCatalog = templateResponse.SkillCatalog
	}
	return CatDirectoryResponse{
		Agents:         directory.Agents,
		Templates:      templates,
		ClientDefaults: clientDefaults,
		SkillCatalog:   skillCatalog,
	}, nil
}

func (c *Clowder) sendCommand(channelID string, channelType uint8, userID string, text string) (RouteResponse, error) {
	return c.sendInboundText(channelID, channelType, userID, text)
}

func (c *Clowder) sendInboundText(channelID string, channelType uint8, userID string, text string) (RouteResponse, error) {
	return c.sendInboundTextWithRouting(channelID, channelType, userID, text, "", nil, "")
}

func (c *Clowder) sendInboundTextWithRouting(channelID string, channelType uint8, userID string, text string, directCatID string, targetCatIDs []string, promptContext string, threadIDs ...string) (RouteResponse, error) {
	threadID := ""
	if len(threadIDs) > 0 {
		threadID = strings.TrimSpace(threadIDs[0])
	}
	return NewClient(c.config.APIBaseURL, c.config.ConnectorSecret, c.config.RequestTimeout).ForwardInbound(InboundMessage{
		ConnectorID:    ConnectorID,
		ExternalChatID: externalChatIDForUser(channelID, channelType, userID),
		ThreadID:       threadID,
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

type upstreamCatCreateResponse struct {
	Cat struct {
		ID              string   `json:"id"`
		CatID           string   `json:"catId"`
		Name            string   `json:"name"`
		DisplayName     string   `json:"displayName"`
		Avatar          string   `json:"avatar"`
		MentionPatterns []string `json:"mentionPatterns"`
		RoleDescription string   `json:"roleDescription"`
		Personality     string   `json:"personality"`
		TeamStrengths   string   `json:"teamStrengths"`
	} `json:"cat"`
}

func (c *Clowder) createCatViaUpstream(req createCatRequest, alias string, userID string) (ClowderAgent, error) {
	if !c.config.IsConfigured() {
		return ClowderAgent{}, fmt.Errorf("clowder bridge is not configured")
	}
	name := strings.TrimSpace(req.Name)
	catID := runtimeCatID(name, alias)
	mentions := []string{normalizeCatAlias(alias, name)}
	template := c.lookupCreateCatTemplate(req.RoleTemplateID, userID)
	capabilitySummary := strings.Join(cleanStringList(req.Capabilities), "、")
	payload := map[string]interface{}{
		"catId":           catID,
		"name":            name,
		"displayName":     name,
		"nickname":        firstTrimmed(template.Nickname, strings.TrimPrefix(strings.TrimSpace(alias), "@")),
		"avatar":          firstTrimmed(template.Avatar, "/avatars/default.png"),
		"color":           map[string]string{"primary": "#3B82F6", "secondary": "#DBEAFE"},
		"mentionPatterns": mentions,
		"accountRef":      strings.TrimSpace(req.AccountRef),
		"roleDescription": firstTrimmed(template.RoleDescription, req.Personality, name+"，由 TangSeng IM 通过 Clowder 新增。"),
		"personality":     firstTrimmed(template.Personality, req.Personality),
		"teamStrengths":   firstTrimmed(template.TeamStrengths, capabilitySummary),
		"clientId":        upstreamCatClientID(req),
		"defaultModel":    strings.TrimSpace(req.DefaultModel),
		"mcpSupport":      true,
	}
	if restrictions := cleanStringList(template.Restrictions); len(restrictions) > 0 {
		payload["restrictions"] = restrictions
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return ClowderAgent{}, err
	}
	endpoint := strings.TrimRight(c.config.APIBaseURL, "/") + "/api/cats"
	httpReq, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return ClowderAgent{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	c.applyDirectoryUserHeader(httpReq, userID)

	res, err := c.httpClient().Do(httpReq)
	if err != nil {
		return ClowderAgent{}, err
	}
	defer res.Body.Close()
	respBody, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return ClowderAgent{}, fmt.Errorf("clowder cat create failed: %s %s", res.Status, strings.TrimSpace(string(respBody)))
	}
	var response upstreamCatCreateResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return ClowderAgent{}, err
	}
	cat := response.Cat
	createdCatID := firstTrimmed(cat.CatID, cat.ID, catID)
	displayName := firstTrimmed(cat.DisplayName, cat.Name, name, createdCatID)
	mentionPatterns := cleanStringList(cat.MentionPatterns)
	if len(mentionPatterns) == 0 {
		mentionPatterns = mentions
	}
	capabilitySummary = firstTrimmed(cat.TeamStrengths, strings.Join(cleanStringList(req.Capabilities), "、"), cat.RoleDescription)
	return ClowderAgent{
		CatID:              createdCatID,
		DisplayName:        displayName,
		Aliases:            mentionPatterns,
		MentionPatterns:    mentionPatterns,
		Avatar:             strings.TrimSpace(cat.Avatar),
		PersonalitySummary: firstTrimmed(cat.Personality, req.Personality),
		CapabilitySummary:  capabilitySummary,
		Available:          true,
		AvailabilityState:  "available",
		Source:             "runtime-created",
		Connected:          true,
	}, nil
}

func (c *Clowder) lookupCreateCatTemplate(roleTemplateID string, userID string) catTemplate {
	needle := normalizeCatLookup(roleTemplateID)
	if needle == "" {
		return catTemplate{}
	}
	response, err := c.fetchCatTemplates(userID)
	if err != nil {
		return catTemplate{}
	}
	for _, template := range response.Templates {
		keys := []string{template.ID, template.Name, template.Nickname}
		for _, key := range keys {
			if normalizeCatLookup(key) == needle {
				return template
			}
		}
	}
	return catTemplate{}
}

func routeTextForCatRequest(req conversationRefRequest) string {
	text := strings.TrimSpace(req.Text)
	if text == "" {
		return ""
	}
	if strings.HasPrefix(text, "/") {
		return text
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

func upstreamCatClientID(req createCatRequest) string {
	switch normalizeCatClientPlatform(req) {
	case "codex":
		return "openai"
	case "claude-code":
		return "anthropic"
	default:
		return ""
	}
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

func firstTrimmed(values ...string) string {
	for _, value := range values {
		text := strings.TrimSpace(value)
		if text != "" {
			return text
		}
	}
	return ""
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

func runtimeCatID(name string, alias string) string {
	value := fallbackCatID(name, alias)
	if value == "" {
		return "cat-" + strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	first := value[0]
	if first < 'a' || first > 'z' {
		value = "cat-" + value
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
