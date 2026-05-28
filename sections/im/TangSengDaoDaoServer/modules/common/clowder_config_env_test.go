package common

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestClowderBridgeConfigFromEnv(t *testing.T) {
	t.Setenv("IM_WEB_CLOWDER_ENABLED", "true")
	t.Setenv("CLOWDER_API_BASE_URL", "http://127.0.0.1:3000")
	t.Setenv("CLOWDER_CONNECTOR_ID", "im-web")
	t.Setenv("CLOWDER_CONNECTOR_SECRET", "shared-secret")
	t.Setenv("CLOWDER_DEFAULT_OWNER_USER_ID", "owner-1")
	t.Setenv("CLOWDER_REQUEST_TIMEOUT_MS", "7000")
	t.Setenv("CLOWDER_SIGNATURE_TOLERANCE_MS", "600000")

	cfg := ClowderBridgeConfigFromEnv()

	assert.True(t, cfg.Enabled)
	assert.Equal(t, "http://127.0.0.1:3000", cfg.APIBaseURL)
	assert.Equal(t, "im-web", cfg.ConnectorID)
	assert.Equal(t, "shared-secret", cfg.ConnectorSecret)
	assert.Equal(t, "owner-1", cfg.DefaultOwnerUserID)
	assert.Equal(t, 7*time.Second, cfg.RequestTimeout)
	assert.Equal(t, 10*time.Minute, cfg.SignatureTolerance)
	assert.True(t, cfg.IsConfigured())
}
