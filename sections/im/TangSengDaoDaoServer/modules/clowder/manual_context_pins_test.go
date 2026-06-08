package clowder

import (
	"bytes"
	"encoding/json"
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

func TestManualContextPinSourceStatusProxyForwardsPatch(t *testing.T) {
	var gotPath string
	var gotMethod string
	var gotUser string
	var gotBody map[string]interface{}

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.RequestURI()
		gotMethod = r.Method
		gotUser = r.Header.Get("x-cat-cafe-user")
		require.NoError(t, json.NewDecoder(r.Body).Decode(&gotBody))
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"pins": []map[string]interface{}{
				{"id": "pin-1", "messageId": "m-1", "status": "source_deleted"},
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

	cfg := config.New()
	cfg.Test = true
	appCtx := config.NewContext(cfg)
	require.NoError(t, appCtx.Cache().Set(cfg.Cache.TokenCachePrefix+"manual-pin-token", wkhttp.EncodeTokenCacheInfo("im-user-1", "Manual Pin User", "")))
	s := server.New(appCtx)
	c.ctx = appCtx
	c.Route(s.GetRoute())

	recorder := httptest.NewRecorder()
	req, _ := http.NewRequest(
		http.MethodPatch,
		"/v1/clowder/thread/thread-1/manual-context-pins/source-status",
		bytes.NewReader([]byte(`{"messageId":"m-1","status":"source_deleted"}`)),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("token", "manual-pin-token")

	s.GetRoute().ServeHTTP(recorder, req)

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, http.MethodPatch, gotMethod)
	assert.Equal(t, "/api/threads/thread-1/manual-context-pins/source-status", gotPath)
	assert.Equal(t, "owner-1", gotUser)
	assert.Equal(t, "m-1", gotBody["messageId"])
	assert.Equal(t, "source_deleted", gotBody["status"])
}
