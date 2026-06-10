package clowder

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	commonmodule "github.com/TangSengDaoDao/TangSengDaoDaoServer/modules/common"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/wkhttp"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/server"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type skillAPITestServer struct {
	bridge *Clowder
	server *server.Server
}

func newSkillAPITestServer(t *testing.T, upstreamOverride ...*httptest.Server) *skillAPITestServer {
	t.Helper()

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/cat-templates":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"templates": []map[string]interface{}{
					{
						"id":            "coordinator",
						"name":          "协调者",
						"teamStrengths": "任务拆解",
					},
				},
				"skillCatalog": map[string]interface{}{
					"codex": []map[string]interface{}{
						{
							"name":        "tdd",
							"category":    "开发流程",
							"trigger":     "TDD",
							"description": "测试驱动开发",
							"mounted":     true,
						},
					},
				},
			})
		case "/api/connectors/im-web/agents":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"agents": []map[string]interface{}{
					{
						"catId":           "codex",
						"displayName":     "Codex",
						"mentionPatterns": []string{"@codex"},
						"available":       true,
					},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	if len(upstreamOverride) > 0 && upstreamOverride[0] != nil {
		upstream.Close()
		upstream = upstreamOverride[0]
	} else {
		t.Cleanup(upstream.Close)
	}

	cfg := config.New()
	cfg.Test = true
	appCtx := config.NewContext(cfg)
	require.NoError(t, appCtx.Cache().Set(cfg.Cache.TokenCachePrefix+"token-user-a", wkhttp.EncodeTokenCacheInfo("user-a", "User A", "")))
	require.NoError(t, appCtx.Cache().Set(cfg.Cache.TokenCachePrefix+"token-user-b", wkhttp.EncodeTokenCacheInfo("user-b", "User B", "")))

	bridge := New(appCtx)
	bridge.SetConfig(commonmodule.ClowderBridgeConfig{
		Enabled:            true,
		APIBaseURL:         upstream.URL,
		ConnectorID:        "im-web",
		ConnectorSecret:    "secret",
		DefaultOwnerUserID: "owner-1",
		RequestTimeout:     time.Second,
		SignatureTolerance: time.Minute,
	})
	s := server.New(appCtx)
	bridge.Route(s.GetRoute())
	return &skillAPITestServer{bridge: bridge, server: s}
}

func (s *skillAPITestServer) request(t *testing.T, method string, path string, body io.Reader, token string, contentType string) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	req, err := http.NewRequest(method, path, body)
	require.NoError(t, err)
	req.Header.Set("token", token)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	s.server.GetRoute().ServeHTTP(recorder, req)
	return recorder
}

func decodeSkillBody(t *testing.T, recorder *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body), recorder.Body.String())
	return body
}

func firstSkillID(t *testing.T, body map[string]interface{}) string {
	t.Helper()
	skills, ok := body["skills"].([]interface{})
	require.True(t, ok, "skills should be an array: %v", body)
	require.NotEmpty(t, skills)
	first, ok := skills[0].(map[string]interface{})
	require.True(t, ok)
	id, _ := first["id"].(string)
	require.NotEmpty(t, id)
	return id
}

func TestSkillAPIsKeepOwnershipIsolatedAndAddIdempotent(t *testing.T) {
	api := newSkillAPITestServer(t)

	marketA := api.request(t, http.MethodGet, "/v1/clowder/skills/marketplace", nil, "token-user-a", "")
	require.Equal(t, http.StatusOK, marketA.Code, marketA.Body.String())
	sourceID := firstSkillID(t, decodeSkillBody(t, marketA))

	addBody := bytes.NewBufferString(`{"sourceId":"` + sourceID + `"}`)
	addA := api.request(t, http.MethodPost, "/v1/clowder/skills/"+sourceID+"/add", addBody, "token-user-a", "application/json")
	require.Equal(t, http.StatusOK, addA.Code, addA.Body.String())
	addAgain := api.request(t, http.MethodPost, "/v1/clowder/skills/"+sourceID+"/add", bytes.NewBufferString(`{}`), "token-user-a", "application/json")
	require.Equal(t, http.StatusOK, addAgain.Code, addAgain.Body.String())

	myA := api.request(t, http.MethodGet, "/v1/clowder/skills", nil, "token-user-a", "")
	require.Equal(t, http.StatusOK, myA.Code, myA.Body.String())
	myABody := decodeSkillBody(t, myA)
	userSkills := myABody["skills"].([]interface{})
	require.Len(t, userSkills, 1)
	assert.Equal(t, "tdd", userSkills[0].(map[string]interface{})["name"])

	myB := api.request(t, http.MethodGet, "/v1/clowder/skills", nil, "token-user-b", "")
	require.Equal(t, http.StatusOK, myB.Code, myB.Body.String())
	assert.Empty(t, decodeSkillBody(t, myB)["skills"].([]interface{}))

	marketBAfter := api.request(t, http.MethodGet, "/v1/clowder/skills/marketplace", nil, "token-user-b", "")
	require.Equal(t, http.StatusOK, marketBAfter.Code, marketBAfter.Body.String())
	skillsB := decodeSkillBody(t, marketBAfter)["skills"].([]interface{})
	assert.False(t, skillsB[0].(map[string]interface{})["added"].(bool))
}

func TestSkillAssignmentsAreScopedToVisibleAgents(t *testing.T) {
	api := newSkillAPITestServer(t)
	market := api.request(t, http.MethodGet, "/v1/clowder/skills/marketplace", nil, "token-user-a", "")
	sourceID := firstSkillID(t, decodeSkillBody(t, market))
	add := api.request(t, http.MethodPost, "/v1/clowder/skills/"+sourceID+"/add", bytes.NewBufferString(`{}`), "token-user-a", "application/json")
	require.Equal(t, http.StatusOK, add.Code, add.Body.String())
	userSkillID := decodeSkillBody(t, add)["skill"].(map[string]interface{})["id"].(string)

	assign := api.request(t, http.MethodPut, "/v1/clowder/skills/"+userSkillID+"/assignments", bytes.NewBufferString(`{"agentIds":["codex"]}`), "token-user-a", "application/json")
	require.Equal(t, http.StatusOK, assign.Code, assign.Body.String())
	assigned := decodeSkillBody(t, assign)["skill"].(map[string]interface{})["agentIds"].([]interface{})
	assert.Equal(t, []interface{}{"codex"}, assigned)

	badAssign := api.request(t, http.MethodPut, "/v1/clowder/skills/"+userSkillID+"/assignments", bytes.NewBufferString(`{"agentIds":["other-user-cat"]}`), "token-user-a", "application/json")
	assert.Equal(t, http.StatusBadRequest, badAssign.Code, badAssign.Body.String())
}

func TestSkillUploadRejectsUnsafeZipAndAddsSafeUploadToCurrentUser(t *testing.T) {
	api := newSkillAPITestServer(t)

	unsafeBody, unsafeContentType := multipartSkillZip(t, map[string]string{
		"../evil.txt": "nope",
		"SKILL.md":    "# unsafe",
	})
	unsafeResp := api.request(t, http.MethodPost, "/v1/clowder/skills/upload", unsafeBody, "token-user-a", unsafeContentType)
	assert.Equal(t, http.StatusBadRequest, unsafeResp.Code, unsafeResp.Body.String())

	safeBody, safeContentType := multipartSkillZip(t, map[string]string{
		"SKILL.md":  "# Safe Skill\n\nA useful uploaded skill.",
		"README.md": "safe",
	})
	safeResp := api.request(t, http.MethodPost, "/v1/clowder/skills/upload", safeBody, "token-user-a", safeContentType)
	require.Equal(t, http.StatusOK, safeResp.Code, safeResp.Body.String())
	uploaded := decodeSkillBody(t, safeResp)["skill"].(map[string]interface{})
	assert.Equal(t, "uploaded", uploaded["addSource"])
	assert.Equal(t, true, uploaded["enabled"])

	myA := api.request(t, http.MethodGet, "/v1/clowder/skills", nil, "token-user-a", "")
	require.Equal(t, http.StatusOK, myA.Code, myA.Body.String())
	assert.Len(t, decodeSkillBody(t, myA)["skills"].([]interface{}), 1)
}

func multipartSkillZip(t *testing.T, entries map[string]string) (*bytes.Buffer, string) {
	t.Helper()

	zipBuffer := &bytes.Buffer{}
	zipWriter := zip.NewWriter(zipBuffer)
	for name, content := range entries {
		writer, err := zipWriter.Create(name)
		require.NoError(t, err)
		_, err = writer.Write([]byte(content))
		require.NoError(t, err)
	}
	require.NoError(t, zipWriter.Close())

	body := &bytes.Buffer{}
	form := multipart.NewWriter(body)
	fileWriter, err := form.CreateFormFile("file", "skill.zip")
	require.NoError(t, err)
	_, err = fileWriter.Write(zipBuffer.Bytes())
	require.NoError(t, err)
	require.NoError(t, form.Close())
	return body, form.FormDataContentType()
}
