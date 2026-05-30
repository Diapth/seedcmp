package clowder

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
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
	assert.Equal(t, "user-1", gotUser)
}
