package clowder

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	commonmodule "github.com/TangSengDaoDao/TangSengDaoDaoServer/modules/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFetchAgentDirectoryProxiesExternalChatAndLoginUser(t *testing.T) {
	var gotPath string
	var gotUser string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.RequestURI()
		gotUser = r.Header.Get("x-cat-cafe-user")
		require.Equal(t, http.MethodGet, r.Method)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"threadId":        "thread-1",
			"preferredCatIds": []string{"codex"},
			"lastActiveCatId": "codex",
			"agents": []map[string]interface{}{
				{
					"catId":           "codex",
					"displayName":     "Codex",
					"mentionPatterns": []string{"@codex"},
					"available":       true,
					"preferred":       true,
				},
			},
		})
	}))
	defer upstream.Close()

	c := New(nil)
	c.SetConfig(commonmodule.ClowderBridgeConfig{
		Enabled:            true,
		APIBaseURL:         upstream.URL,
		ConnectorID:        "im-web",
		ConnectorSecret:    "secret",
		DefaultOwnerUserID: "owner-1",
		RequestTimeout:     time.Second,
		SignatureTolerance: time.Minute,
	})

	directory, err := c.fetchAgentDirectory("group-clowder", 2, "user-1")

	require.NoError(t, err)
	require.Len(t, directory.Agents, 1)
	assert.Equal(t, "codex", directory.Agents[0].CatID)
	assert.Equal(t, "Codex", directory.Agents[0].DisplayName)
	assert.Equal(t, []string{"codex"}, directory.PreferredCatIDs)
	assert.Equal(t, "codex", directory.LastActiveCatID)
	assert.Equal(t, "/api/connectors/im-web/agents?externalChatId=2%3Agroup-clowder", gotPath)
	assert.Equal(t, "owner-1", gotUser)
}

func TestFetchAgentDirectoryUsesBridgeOwnerForClowderThreadAuth(t *testing.T) {
	var gotPath string
	var gotUser string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.RequestURI()
		gotUser = r.Header.Get("x-cat-cafe-user")
		require.Equal(t, http.MethodGet, r.Method)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"threadId":        "thread-1",
			"preferredCatIds": []string{"codex"},
			"lastActiveCatId": "codex",
			"agents": []map[string]interface{}{
				{
					"catId":           "codex",
					"displayName":     "Codex",
					"mentionPatterns": []string{"@codex"},
					"available":       true,
					"preferred":       true,
				},
			},
		})
	}))
	defer upstream.Close()

	c := New(nil)
	c.SetConfig(commonmodule.ClowderBridgeConfig{
		Enabled:            true,
		APIBaseURL:         upstream.URL,
		ConnectorID:        "im-web",
		ConnectorSecret:    "secret",
		DefaultOwnerUserID: "default-user",
		RequestTimeout:     time.Second,
		SignatureTolerance: time.Minute,
	})

	directory, err := c.fetchAgentDirectory("clowder_cat:codex", 1, "im-user-1")

	require.NoError(t, err)
	require.Len(t, directory.Agents, 1)
	assert.Equal(t, "codex", directory.Agents[0].CatID)
	assert.Contains(t, gotPath, "/api/connectors/im-web/agents?externalChatId=1%3A")
	assert.Contains(t, gotPath, "im-user-1")
	assert.Equal(t, "default-user", gotUser)
}

func TestFetchCatDirectoryUsesDirectHubAndKeepsExistingRagdoll(t *testing.T) {
	gotPaths := []string{}
	gotUsers := []string{}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPaths = append(gotPaths, r.URL.RequestURI())
		gotUsers = append(gotUsers, r.Header.Get("x-cat-cafe-user"))
		require.Equal(t, http.MethodGet, r.Method)
		switch r.URL.Path {
		case "/api/connectors/im-web/agents":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"agents": []map[string]interface{}{
					{
						"catId":           "opus",
						"displayName":     "布偶猫",
						"mentionPatterns": []string{"@opus", "@布偶猫"},
						"available":       true,
					},
				},
			})
		case "/api/cat-templates":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"templates": []map[string]interface{}{
					{
						"id":            "coordinator",
						"name":          "协调者",
						"nickname":      "PM",
						"avatar":        "/avatars/keeper.png",
						"personality":   "清晰、稳健",
						"teamStrengths": "需求澄清、任务拆分",
						"restrictions":  []string{"禁止生成内容或独立完成具体任务", "必须派发给合适执行猫"},
					},
				},
				"clientDefaults": map[string]interface{}{
					"openai": map[string]interface{}{
						"defaultModel": "gpt-5.4",
						"models":       []string{"gpt-5.4"},
					},
				},
				"skillCatalog": map[string]interface{}{
					"codex": []map[string]interface{}{
						{
							"name":        "tdd",
							"category":    "开发流程链",
							"trigger":     "TDD",
							"description": "测试驱动开发",
						},
					},
					"claude": []map[string]interface{}{
						{
							"name":     "deep-research",
							"category": "研究",
							"trigger":  "deep research",
						},
					},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()

	c := New(nil)
	c.SetConfig(commonmodule.ClowderBridgeConfig{
		Enabled:            true,
		APIBaseURL:         upstream.URL,
		ConnectorID:        "im-web",
		ConnectorSecret:    "secret",
		DefaultOwnerUserID: "owner-1",
		RequestTimeout:     time.Second,
		SignatureTolerance: time.Minute,
	})

	directory, err := c.fetchCatDirectory("leng_test_updated")

	require.NoError(t, err)
	require.Len(t, directory.Agents, 1)
	require.Len(t, directory.Templates, 1)
	assert.Equal(t, "opus", directory.Agents[0].CatID)
	assert.Equal(t, "coordinator", directory.Templates[0].RoleTemplateID)
	assert.Equal(t, "协调者", directory.Templates[0].DisplayName)
	assert.Equal(t, []string{"禁止生成内容或独立完成具体任务", "必须派发给合适执行猫"}, directory.Templates[0].Restrictions)
	require.Len(t, directory.SkillCatalog["codex"], 1)
	assert.Equal(t, "tdd", directory.SkillCatalog["codex"][0].Name)
	require.Len(t, directory.SkillCatalog["claude"], 1)
	assert.Equal(t, "deep-research", directory.SkillCatalog["claude"][0].Name)
	assert.Equal(t, "gpt-5.4", directory.ClientDefaults["openai"].DefaultModel)
	assert.Equal(t, "布偶猫", directory.Agents[0].DisplayName)
	assert.Equal(t, []string{"@opus", "@布偶猫"}, directory.Agents[0].MentionPatterns)
	assert.True(t, directory.Agents[0].Connected)
	assert.Equal(t, "existing", directory.Agents[0].Source)
	require.Len(t, gotPaths, 2)
	assert.Contains(t, gotPaths[0], "/api/connectors/im-web/agents?externalChatId=1%3A")
	assert.Contains(t, gotPaths[0], "leng_test_updated")
	assert.NotContains(t, gotPaths[0], "externalChatId=1%3Aclowder_ai&")
	assert.Equal(t, "/api/cat-templates", gotPaths[1])
	assert.Equal(t, []string{"owner-1", "owner-1"}, gotUsers)
}

func TestFetchCatDirectoryFallsBackToTemplateCandidatesWhenAgentDirectoryFails(t *testing.T) {
	gotPaths := []string{}
	gotUsers := []string{}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPaths = append(gotPaths, r.URL.RequestURI())
		gotUsers = append(gotUsers, r.Header.Get("x-cat-cafe-user"))
		require.Equal(t, http.MethodGet, r.Method)
		switch r.URL.Path {
		case "/api/connectors/im-web/agents":
			http.Error(w, "agents unavailable", http.StatusBadGateway)
		case "/api/cat-templates":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"templates": []map[string]interface{}{
					{
						"id":              "ragdoll",
						"name":            "布偶猫",
						"nickname":        "宪宪",
						"avatar":          "/avatars/opus.png",
						"roleDescription": "主架构师和核心开发者，擅长深度思考和系统设计",
						"personality":     "温柔但有主见",
						"teamStrengths":   "架构设计、写代码一把好手",
					},
					{
						"id":              "maine-coon",
						"name":            "Codex",
						"nickname":        "Codex",
						"avatar":          "/avatars/codex.png",
						"roleDescription": "代码审查专家",
						"personality":     "严谨认真",
						"teamStrengths":   "Review、找 bug、coding 落地",
					},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()

	c := New(nil)
	c.SetConfig(commonmodule.ClowderBridgeConfig{
		Enabled:            true,
		APIBaseURL:         upstream.URL,
		ConnectorID:        "im-web",
		ConnectorSecret:    "secret",
		DefaultOwnerUserID: "owner-1",
		RequestTimeout:     time.Second,
		SignatureTolerance: time.Minute,
	})

	directory, err := c.fetchCatDirectory("leng_test_updated")

	require.NoError(t, err)
	require.Len(t, directory.Agents, 2)
	require.Len(t, directory.Templates, 2)
	assert.Equal(t, "ragdoll", directory.Agents[0].CatID)
	assert.Equal(t, "ragdoll", directory.Templates[0].RoleTemplateID)
	assert.Equal(t, "布偶猫", directory.Templates[0].DisplayName)
	assert.Equal(t, "宪宪", directory.Templates[0].Nickname)
	assert.Equal(t, "主架构师和核心开发者，擅长深度思考和系统设计", directory.Templates[0].RoleDescription)
	assert.Equal(t, "温柔但有主见", directory.Templates[0].Personality)
	assert.Equal(t, "架构设计、写代码一把好手", directory.Templates[0].TeamStrengths)
	assert.True(t, directory.Templates[0].Cloneable)
	assert.Equal(t, "role-template", directory.Templates[0].Source)
	assert.Equal(t, "布偶猫", directory.Agents[0].DisplayName)
	assert.Equal(t, []string{"@ragdoll", "@布偶猫", "@宪宪"}, directory.Agents[0].MentionPatterns)
	assert.Equal(t, "架构设计、写代码一把好手", directory.Agents[0].CapabilitySummary)
	assert.True(t, directory.Agents[0].Available)
	assert.False(t, directory.Agents[0].Connected)
	assert.Equal(t, "disconnected", directory.Agents[0].Source)
	assert.Equal(t, "available", directory.Agents[0].AvailabilityState)
	require.Len(t, gotPaths, 2)
	assert.Contains(t, gotPaths[0], "/api/connectors/im-web/agents?externalChatId=1%3A")
	assert.Contains(t, gotPaths[0], "leng_test_updated")
	assert.Equal(t, "/api/cat-templates", gotPaths[1])
	assert.Equal(t, []string{"owner-1", "owner-1"}, gotUsers)
}

func TestCatContactResponseFindsExistingCatByDisplayNameOrMention(t *testing.T) {
	directory := AgentDirectoryResponse{
		Agents: []ClowderAgent{
			{
				CatID:           "opus",
				DisplayName:     "布偶猫",
				MentionPatterns: []string{"@opus", "@布偶猫"},
				Available:       true,
			},
		},
	}

	byDisplay, ok := catContactResponse("布偶猫", directory.Agents, "existing")
	require.True(t, ok)
	assert.Equal(t, "opus", byDisplay.Agent.CatID)
	assert.Equal(t, "布偶猫", byDisplay.Agent.DisplayName)
	assert.True(t, byDisplay.Agent.Connected)
	assert.True(t, byDisplay.Contact.Connected)

	byMention, ok := catContactResponse("@布偶猫", directory.Agents, "existing")
	require.True(t, ok)
	assert.Equal(t, "opus", byMention.Agent.CatID)
}

func TestDecorateCatContactKeepsDisconnectedTemplateCandidateUnconnected(t *testing.T) {
	agent := decorateCatContact(ClowderAgent{
		CatID:           "opus",
		DisplayName:     "布偶猫",
		MentionPatterns: []string{"@opus", "@布偶猫"},
		Available:       false,
		Source:          "disconnected",
	}, "existing")

	assert.False(t, agent.Connected)
	assert.Equal(t, "unavailable", agent.AvailabilityState)
	assert.Equal(t, "disconnected", agent.Source)
}

func TestDecorateCatDirectoryContactAllowsDisconnectedTemplateCandidateToBeAdded(t *testing.T) {
	agent := decorateCatDirectoryContact(ClowderAgent{
		CatID:           "opus",
		DisplayName:     "布偶猫",
		MentionPatterns: []string{"@opus", "@布偶猫"},
		Available:       false,
		Source:          "disconnected",
	})

	assert.True(t, agent.Available)
	assert.False(t, agent.Connected)
	assert.Equal(t, "available", agent.AvailabilityState)
	assert.Equal(t, "disconnected", agent.Source)
}

func TestFetchLocalAuthCapabilitiesProxiesRedactedProbe(t *testing.T) {
	var gotPath string
	var gotUser string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.RequestURI()
		gotUser = r.Header.Get("x-cat-cafe-user")
		require.Equal(t, http.MethodGet, r.Method)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"providers": []map[string]interface{}{
				{
					"provider":       "codex",
					"authConfigured": true,
					"configPresent":  true,
					"configFiles": []map[string]interface{}{
						{"path": "~/.codex/auth.json", "exists": true, "readable": true},
					},
				},
			},
		})
	}))
	defer upstream.Close()

	c := New(nil)
	c.SetConfig(commonmodule.ClowderBridgeConfig{
		Enabled:            true,
		APIBaseURL:         upstream.URL,
		ConnectorID:        "im-web",
		ConnectorSecret:    "secret",
		DefaultOwnerUserID: "owner-1",
		RequestTimeout:     time.Second,
		SignatureTolerance: time.Minute,
	})

	statusCode, body, err := c.fetchLocalAuthCapabilities("im-user-1")

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, statusCode)
	assert.Contains(t, string(body), `"provider":"codex"`)
	assert.Equal(t, "/api/local-auth/capabilities", gotPath)
	assert.Equal(t, "owner-1", gotUser)
}

func TestRouteTextForDirectCatUsesPlainMentionToAutoCreateThread(t *testing.T) {
	text := routeTextForCatRequest(conversationRefRequest{
		Text:        "你好，今天状态如何？",
		DirectCatID: "opus",
	})

	assert.Equal(t, "@opus 你好，今天状态如何？", text)
}

func TestRouteTextForSingleGroupTargetUsesPlainMentionToAutoCreateThread(t *testing.T) {
	text := routeTextForCatRequest(conversationRefRequest{
		Text:         "@布偶猫 帮我总结",
		TargetCatIDs: []string{"opus"},
	})

	assert.True(t, strings.HasPrefix(text, "@opus "))
	assert.Contains(t, text, "@布偶猫 帮我总结")
}

func TestRouteTextForDirectCatKeepsSlashCommandUnprefixed(t *testing.T) {
	text := routeTextForCatRequest(conversationRefRequest{
		Text:        "/new PM",
		DirectCatID: "coordinator",
	})

	assert.Equal(t, "/new PM", text)
}

func TestSendInboundTextWithRoutingForwardsExplicitTargets(t *testing.T) {
	var got InboundMessage
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "/api/connectors/im-web/inbound", r.URL.Path)
		require.NoError(t, json.NewDecoder(r.Body).Decode(&got))
		_ = json.NewEncoder(w).Encode(RouteResponse{Kind: "routed", ThreadID: "thread-1", MessageID: "msg-1"})
	}))
	defer upstream.Close()

	c := New(nil)
	c.SetConfig(commonmodule.ClowderBridgeConfig{
		Enabled:            true,
		APIBaseURL:         upstream.URL,
		ConnectorID:        "im-web",
		ConnectorSecret:    "secret",
		DefaultOwnerUserID: "owner-1",
		RequestTimeout:     time.Second,
		SignatureTolerance: time.Minute,
	})

	response, err := c.sendInboundTextWithRouting("group-1", 2, "user-1", "帮我拆任务", "coordinator", []string{"coordinator"}, "Group context")

	require.NoError(t, err)
	assert.Equal(t, "thread-1", response.ThreadID)
	assert.Equal(t, "2:group-1", got.ExternalChatID)
	assert.Equal(t, "coordinator", got.DirectCatID)
	assert.Equal(t, []string{"coordinator"}, got.TargetCatIDs)
	assert.Equal(t, "Group context", got.PromptContext)
}

func TestGroupCatMembershipStoreRoundTripsPromptAndCats(t *testing.T) {
	c := New(nil)

	stored := c.storeGroupCats(groupCatSyncRequest{
		GroupID:   "group-1",
		GroupName: "猫家庭",
		CatIDs:    []string{"opus"},
		Cats: []ClowderAgent{{
			CatID:           "opus",
			DisplayName:     "布偶猫",
			MentionPatterns: []string{"@布偶猫"},
			Available:       true,
		}},
		Prompt: "Group: 猫家庭\nCats:\n- 布偶猫",
	})
	loaded, ok := c.loadGroupCats("group-1")

	require.True(t, ok)
	assert.Equal(t, "group-1", loaded.GroupID)
	assert.Equal(t, "猫家庭", loaded.GroupName)
	assert.Equal(t, []string{"opus"}, loaded.CatIDs)
	require.Len(t, loaded.Cats, 1)
	assert.Equal(t, "布偶猫", loaded.Cats[0].DisplayName)
	assert.True(t, loaded.Cats[0].Connected)
	assert.Equal(t, stored.Prompt, loaded.Prompt)
}

func TestProjectGroupBindingKeyScopesByUserDirectPMAndProject(t *testing.T) {
	left := projectGroupBindingKey("user-1", "clowder_cat:coordinator", 1, " 婚礼 ")
	right := projectGroupBindingKey("user-1", "clowder_cat:coordinator", 1, "婚礼")
	otherUser := projectGroupBindingKey("user-2", "clowder_cat:coordinator", 1, "婚礼")
	otherProject := projectGroupBindingKey("user-1", "clowder_cat:coordinator", 1, "todo")

	assert.Equal(t, left, right)
	assert.NotEqual(t, left, otherUser)
	assert.NotEqual(t, left, otherProject)
	assert.Contains(t, left, "clowder_cat")
}

func TestFindActiveProjectGroupBindingReturnsLatestForDirect(t *testing.T) {
	c := New(nil)
	c.projectGroupBindings = map[string]ProjectGroupBinding{
		"old": {
			ID:                  "binding-old",
			UserID:              "user-1",
			ProjectName:         "婚礼",
			PMDirectChannelID:   "clowder_cat:coordinator",
			PMDirectChannelType: 1,
			ProjectGroupNo:      "group-old",
			UpdatedAt:           100,
			Status:              "active",
		},
		"new": {
			ID:                  "binding-new",
			UserID:              "user-1",
			ProjectName:         "todo",
			PMDirectChannelID:   "clowder_cat:coordinator",
			PMDirectChannelType: 1,
			ProjectGroupNo:      "group-new",
			UpdatedAt:           200,
			Status:              "active",
		},
		"archived": {
			ID:                  "binding-archived",
			UserID:              "user-1",
			ProjectName:         "later",
			PMDirectChannelID:   "clowder_cat:coordinator",
			PMDirectChannelType: 1,
			ProjectGroupNo:      "group-archived",
			UpdatedAt:           300,
			Status:              "archived",
		},
	}

	latest, ok := c.findActiveProjectGroupBinding("user-1", "clowder_cat:coordinator", 1, "")
	require.True(t, ok)
	assert.Equal(t, "binding-new", latest.ID)

	named, ok := c.findActiveProjectGroupBinding("user-1", "clowder_cat:coordinator", 1, "婚礼")
	require.True(t, ok)
	assert.Equal(t, "binding-old", named.ID)
}

func TestFindActiveProjectGroupBindingByGroupNo(t *testing.T) {
	c := New(nil)
	c.projectGroupBindings = map[string]ProjectGroupBinding{
		"target": {
			ID:                  "binding-target",
			UserID:              "user-1",
			ProjectName:         "验收项目",
			PMDirectChannelID:   "clowder_cat:coordinator",
			PMDirectChannelType: 1,
			ProjectGroupNo:      "group-target",
			ProjectThreadID:     "thread-target",
			UpdatedAt:           200,
			Status:              "active",
		},
		"other-user": {
			ID:                  "binding-other-user",
			UserID:              "user-2",
			ProjectName:         "验收项目",
			PMDirectChannelID:   "clowder_cat:coordinator",
			PMDirectChannelType: 1,
			ProjectGroupNo:      "group-target",
			ProjectThreadID:     "thread-wrong-user",
			UpdatedAt:           300,
			Status:              "active",
		},
		"archived": {
			ID:                  "binding-archived",
			UserID:              "user-1",
			ProjectName:         "归档项目",
			PMDirectChannelID:   "clowder_cat:coordinator",
			PMDirectChannelType: 1,
			ProjectGroupNo:      "group-archived",
			ProjectThreadID:     "thread-archived",
			UpdatedAt:           400,
			Status:              "archived",
		},
	}

	binding, ok := c.findActiveProjectGroupBindingByGroupNo("user-1", "group-target")

	require.True(t, ok)
	assert.Equal(t, "binding-target", binding.ID)
	assert.Equal(t, "thread-target", binding.ProjectThreadID)

	_, ok = c.findActiveProjectGroupBindingByGroupNo("user-1", "group-archived")
	assert.False(t, ok)
}

func TestUpdateProjectGroupBindingThreadPersistsThreadID(t *testing.T) {
	c := New(nil)
	key := projectGroupBindingKey("user-1", "clowder_cat:coordinator", 1, "婚礼")
	c.projectGroupBindings = map[string]ProjectGroupBinding{
		key: {
			ID:                  "binding-1",
			UserID:              "user-1",
			ProjectName:         "婚礼",
			PMDirectChannelID:   "clowder_cat:coordinator",
			PMDirectChannelType: 1,
			ProjectGroupNo:      "group-1",
			UpdatedAt:           100,
			Status:              "active",
		},
	}

	updated, ok := c.updateProjectGroupBindingThread("binding-1", "user-1", "thread-project-1")

	require.True(t, ok)
	assert.Equal(t, "thread-project-1", updated.ProjectThreadID)
	assert.Equal(t, "thread-project-1", c.projectGroupBindings[key].ProjectThreadID)
	assert.Greater(t, c.projectGroupBindings[key].UpdatedAt, int64(100))
}

func TestProjectGroupRequiredMembersAlwaysIncludeUserAndPM(t *testing.T) {
	members := projectGroupRequiredMemberUIDs("user-1", defaultPMMemberID, []string{"user-1", "helper-1", defaultPMMemberID})

	assert.Equal(t, []string{"user-1", defaultPMMemberID, "helper-1"}, members)
}

func TestProjectGroupRequiredMembersMergeExistingBindingAndRequestMembers(t *testing.T) {
	members := projectGroupRequiredMemberUIDsForBinding(
		"user-1",
		defaultPMMemberID,
		[]string{"helper-old", "user-1"},
		[]string{"helper-new", "helper-old"},
	)

	assert.Equal(t, []string{"user-1", defaultPMMemberID, "helper-old", "helper-new"}, members)
}

func TestFindOrCreateProjectGroupAcceptsExtraHumanMembers(t *testing.T) {
	c := New(nil)

	_, _, err := c.findOrCreateProjectGroup("项目群", "user-1", defaultPMMemberID, []string{"helper-1"})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "im context unavailable")
}

func TestNormalizeProjectGroupNameTrimsQuotesAndLength(t *testing.T) {
	assert.Equal(t, "PM项目群验收", normalizeProjectGroupName("「PM项目群验收」"))
	assert.Equal(t, "项目群聊", normalizeProjectGroupName(" "))
	assert.Len(t, []rune(normalizeProjectGroupName("这是一个特别特别特别长的项目名称用于验证截断")), 20)
}

func TestDeleteCatFromUpstreamProxiesOwnerAndStatus(t *testing.T) {
	var gotPath string
	var gotUser string
	var gotMethod string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.RequestURI()
		gotUser = r.Header.Get("x-cat-cafe-user")
		gotMethod = r.Method
		w.WriteHeader(http.StatusAccepted)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"deleted": true,
			"id":      "opus",
		})
	}))
	defer upstream.Close()

	c := New(nil)
	c.SetConfig(commonmodule.ClowderBridgeConfig{
		Enabled:            true,
		APIBaseURL:         upstream.URL,
		ConnectorID:        "im-web",
		ConnectorSecret:    "secret",
		DefaultOwnerUserID: "owner-1",
		RequestTimeout:     time.Second,
		SignatureTolerance: time.Minute,
	})

	statusCode, body, err := c.deleteCatFromUpstream("opus", "im-user")

	require.NoError(t, err)
	assert.Equal(t, http.StatusAccepted, statusCode)
	assert.Equal(t, http.MethodDelete, gotMethod)
	assert.Equal(t, "/api/cats/opus", gotPath)
	assert.Equal(t, "owner-1", gotUser)
	assert.Contains(t, string(body), `"deleted":true`)
}

func TestDeleteCatFromUpstreamReturnsUpstreamErrorStatus(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodDelete, r.Method)
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Cat not found",
		})
	}))
	defer upstream.Close()

	c := New(nil)
	c.SetConfig(commonmodule.ClowderBridgeConfig{
		Enabled:            true,
		APIBaseURL:         upstream.URL,
		ConnectorID:        "im-web",
		ConnectorSecret:    "secret",
		DefaultOwnerUserID: "owner-1",
		RequestTimeout:     time.Second,
		SignatureTolerance: time.Minute,
	})

	statusCode, body, err := c.deleteCatFromUpstream("missing-cat", "im-user")

	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, statusCode)
	assert.Contains(t, string(body), "Cat not found")
}

func TestPruneGroupCatStateRemovesDeletedCatAndClearsEmptyPrompt(t *testing.T) {
	c := New(nil)
	c.storeGroupCats(groupCatSyncRequest{
		GroupID:   "group-1",
		GroupName: "猫家庭",
		CatIDs:    []string{"opus", "codex"},
		Cats: []ClowderAgent{
			{CatID: "opus", DisplayName: "布偶猫", MentionPatterns: []string{"@布偶猫"}, Available: true},
			{CatID: "codex", DisplayName: "猫猫", MentionPatterns: []string{"@codex"}, Available: true},
		},
		Prompt: "Group: 猫家庭\nCats:\n- 布偶猫\n- 猫猫",
	})
	c.storeGroupCats(groupCatSyncRequest{
		GroupID:   "group-empty",
		GroupName: "只有布偶猫",
		CatIDs:    []string{"opus"},
		Cats: []ClowderAgent{
			{CatID: "opus", DisplayName: "布偶猫", MentionPatterns: []string{"@布偶猫"}, Available: true},
		},
		Prompt: "Group: 只有布偶猫\nCats:\n- 布偶猫",
	})

	affected := c.pruneGroupCatState("opus")

	assert.Equal(t, 2, affected)
	groupOne, ok := c.loadGroupCats("group-1")
	require.True(t, ok)
	assert.Equal(t, []string{"codex"}, groupOne.CatIDs)
	require.Len(t, groupOne.Cats, 1)
	assert.Equal(t, "codex", groupOne.Cats[0].CatID)
	assert.NotEmpty(t, groupOne.Prompt)

	emptyGroup, ok := c.loadGroupCats("group-empty")
	require.True(t, ok)
	assert.Empty(t, emptyGroup.CatIDs)
	assert.Empty(t, emptyGroup.Cats)
	assert.Empty(t, emptyGroup.Prompt)
}

func TestBuildCreateCatCommandRequiresAndNormalizesClientPlatform(t *testing.T) {
	command, ok := buildCreateCatCommand(createCatRequest{
		Name:       "测试猫",
		Alias:      "@testcat",
		ClientID:   "openai",
		AuthType:   "oauth",
		AccountRef: "codex",
	})

	require.True(t, ok)
	assert.Equal(t, "/cats new 测试猫 @testcat --platform codex --auth oauth --account codex", command)

	command, ok = buildCreateCatCommand(createCatRequest{
		Name:           "Claude猫",
		Alias:          "@claude-cat",
		RoleTemplateID: "ragdoll",
		ClientID:       "anthropic",
		AuthType:       "api_key",
		AccountRef:     "anthropic-prod",
		DefaultModel:   "claude-sonnet-4-6",
	})

	require.True(t, ok)
	assert.Equal(t, "/cats new Claude猫 @claude-cat --platform claude-code --auth api-key --account anthropic-prod --model claude-sonnet-4-6 --role-template ragdoll", command)

	_, ok = buildCreateCatCommand(createCatRequest{Name: "无平台猫"})
	assert.False(t, ok)

	_, ok = buildCreateCatCommand(createCatRequest{Name: "无认证猫", ClientID: "openai"})
	assert.False(t, ok)
}

func TestCreateCatAndConnectAutoBindsDirectThread(t *testing.T) {
	inboundMessages := []InboundMessage{}
	var gotCreateCat map[string]interface{}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/cats":
			require.Equal(t, http.MethodPost, r.Method)
			require.NoError(t, json.NewDecoder(r.Body).Decode(&gotCreateCat))
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"cat": map[string]interface{}{
					"id":              "coordinator",
					"catId":           "coordinator",
					"displayName":     "PM",
					"mentionPatterns": []string{"@pm"},
					"available":       true,
				},
			})
		case "/api/connectors/im-web/inbound":
			var message InboundMessage
			require.NoError(t, json.NewDecoder(r.Body).Decode(&message))
			inboundMessages = append(inboundMessages, message)
			if strings.HasPrefix(message.Text, "/new") {
				_ = json.NewEncoder(w).Encode(RouteResponse{Kind: "routed", ThreadID: "thread-pm-1", MessageID: "msg-thread"})
				return
			}
			_ = json.NewEncoder(w).Encode(RouteResponse{Kind: "routed", MessageID: "msg-create"})
		case "/api/connectors/im-web/agents":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"agents": []map[string]interface{}{
					{
						"catId":           "coordinator",
						"displayName":     "PM",
						"aliases":         []string{"@pm"},
						"mentionPatterns": []string{"@pm"},
						"available":       true,
					},
				},
			})
		case "/api/cat-templates":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"templates": []map[string]interface{}{
					{
						"id":              "coordinator",
						"name":            "暹罗猫（协调者）",
						"nickname":        "罗罗",
						"avatar":          "/avatars/keeper.png",
						"roleDescription": "显性 PM / 主 Agent，只协调、少直接执行",
						"personality":     "话痨但聪明，优先级意识极强",
						"teamStrengths":   "需求澄清、任务拆分、并行调度、结果合成、交付闭环",
						"restrictions": []string{
							"禁止默认亲自写代码、改文件、执行测试、生成内容或独立完成具体任务；必须优先拆解并派发给合适执行猫",
							"禁止跳过执行猫返回结果直接给最终交付；必须接收、合成并标明各执行猫产出",
						},
					},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()
	api := newSkillAPITestServer(t, upstream)

	resp := api.request(t, http.MethodPost, "/v1/clowder/cats", strings.NewReader(`{
		"name":"PM",
		"alias":"@pm",
		"roleTemplateId":"coordinator",
		"clientId":"openai",
		"authType":"oauth",
		"accountRef":"codex"
	}`), "token-user-a", "application/json")

	require.Equal(t, http.StatusOK, resp.Code, resp.Body.String())
	body := decodeSkillBody(t, resp)
	assert.Equal(t, "thread-pm-1", body["threadId"])
	binding, ok := body["binding"].(map[string]interface{})
	require.True(t, ok, "binding should be returned: %v", body)
	assert.Equal(t, "clowder_cat:coordinator", binding["channelId"])
	assert.Equal(t, "thread-pm-1", binding["threadId"])
	require.NotNil(t, gotCreateCat)
	assert.Equal(t, "pm", gotCreateCat["catId"])
	assert.Equal(t, "PM", gotCreateCat["displayName"])
	assert.Equal(t, []interface{}{"@pm"}, gotCreateCat["mentionPatterns"])
	assert.Equal(t, "显性 PM / 主 Agent，只协调、少直接执行", gotCreateCat["roleDescription"])
	assert.Equal(t, "话痨但聪明，优先级意识极强", gotCreateCat["personality"])
	assert.Equal(t, "需求澄清、任务拆分、并行调度、结果合成、交付闭环", gotCreateCat["teamStrengths"])
	assert.Equal(t, []interface{}{
		"禁止默认亲自写代码、改文件、执行测试、生成内容或独立完成具体任务；必须优先拆解并派发给合适执行猫",
		"禁止跳过执行猫返回结果直接给最终交付；必须接收、合成并标明各执行猫产出",
	}, gotCreateCat["restrictions"])
	require.Len(t, inboundMessages, 1)
	assert.Equal(t, "clowder_cat:coordinator", inboundMessages[0].ChannelID)
	assert.Equal(t, "/new PM", inboundMessages[0].Text)
}

func TestCreatedCatContactsPrependFallbackCatsToDirectory(t *testing.T) {
	c := New(nil)
	fallback := fallbackCreatedCatResponse(createCatRequest{
		Name:         "V13验收猫",
		Alias:        "@v13cat",
		Personality:  "live proof",
		Capabilities: []string{"项目拆解"},
	}, "@v13cat")
	c.storeCreatedCatContact("user-1", fallback.Agent)

	merged := c.mergeCreatedCatContacts("user-1", []ClowderAgent{
		{CatID: "coordinator", DisplayName: "PM", Available: true, Source: "existing"},
	})

	require.Len(t, merged, 2)
	assert.Equal(t, "v13cat", merged[0].CatID)
	assert.Equal(t, "V13验收猫", merged[0].DisplayName)
	assert.Equal(t, "runtime-created", merged[0].Source)
	assert.True(t, merged[0].Connected)
	assert.Equal(t, "coordinator", merged[1].CatID)
}
