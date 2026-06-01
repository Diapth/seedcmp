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
	var gotPath string
	var gotUser string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.RequestURI()
		gotUser = r.Header.Get("x-cat-cafe-user")
		require.Equal(t, http.MethodGet, r.Method)
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
	assert.Equal(t, "opus", directory.Agents[0].CatID)
	assert.Equal(t, "布偶猫", directory.Agents[0].DisplayName)
	assert.Equal(t, []string{"@opus", "@布偶猫"}, directory.Agents[0].MentionPatterns)
	assert.True(t, directory.Agents[0].Connected)
	assert.Equal(t, "existing", directory.Agents[0].Source)
	assert.Contains(t, gotPath, "/api/connectors/im-web/agents?externalChatId=1%3A")
	assert.Contains(t, gotPath, "leng_test_updated")
	assert.NotContains(t, gotPath, "externalChatId=1%3Aclowder_ai&")
	assert.Equal(t, "owner-1", gotUser)
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

	byDisplay, ok := catContactResponse("布偶猫", directory, "existing")
	require.True(t, ok)
	assert.Equal(t, "opus", byDisplay.Agent.CatID)
	assert.Equal(t, "布偶猫", byDisplay.Agent.DisplayName)
	assert.True(t, byDisplay.Agent.Connected)
	assert.True(t, byDisplay.Contact.Connected)

	byMention, ok := catContactResponse("@布偶猫", directory, "existing")
	require.True(t, ok)
	assert.Equal(t, "opus", byMention.Agent.CatID)
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

func TestBuildCreateCatCommandRequiresAndNormalizesClientPlatform(t *testing.T) {
	command, ok := buildCreateCatCommand(createCatRequest{
		Name:     "测试猫",
		Alias:    "@testcat",
		ClientID: "openai",
		AuthType: "oauth",
		AccountRef: "codex",
	})

	require.True(t, ok)
	assert.Equal(t, "/cats new 测试猫 @testcat --platform codex --auth oauth --account codex", command)

	command, ok = buildCreateCatCommand(createCatRequest{
		Name:     "Claude猫",
		Alias:    "@claude-cat",
		ClientID: "anthropic",
		AuthType: "api_key",
		AccountRef: "anthropic-prod",
	})

	require.True(t, ok)
	assert.Equal(t, "/cats new Claude猫 @claude-cat --platform claude-code --auth api-key --account anthropic-prod", command)

	_, ok = buildCreateCatCommand(createCatRequest{Name: "无平台猫"})
	assert.False(t, ok)

	_, ok = buildCreateCatCommand(createCatRequest{Name: "无认证猫", ClientID: "openai"})
	assert.False(t, ok)
}
