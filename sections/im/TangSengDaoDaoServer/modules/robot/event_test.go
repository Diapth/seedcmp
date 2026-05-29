package robot

import (
	"os"
	"testing"

	commonmodule "github.com/TangSengDaoDao/TangSengDaoDaoServer/modules/common"
	"github.com/stretchr/testify/assert"
)

func TestRobotRoutingDisabledWhenClowderBridgeConfigured(t *testing.T) {
	t.Setenv("IM_WEB_CLOWDER_ENABLED", "true")
	t.Setenv("CLOWDER_API_BASE_URL", "http://127.0.0.1:3000")
	t.Setenv("CLOWDER_CONNECTOR_SECRET", "shared-secret")
	t.Setenv("CLOWDER_DEFAULT_OWNER_USER_ID", "owner-1")

	assert.True(t, commonmodule.ClowderBridgeConfigFromEnv().IsConfigured())
	assert.True(t, shouldSkipLegacyRobotRoutingForClowder())
}

func TestRobotRoutingRemainsEnabledWithoutClowderBridge(t *testing.T) {
	for _, key := range []string{"IM_WEB_CLOWDER_ENABLED", "CLOWDER_API_BASE_URL", "CLOWDER_CONNECTOR_SECRET", "CLOWDER_DEFAULT_OWNER_USER_ID"} {
		os.Unsetenv(key)
	}

	assert.False(t, commonmodule.ClowderBridgeConfigFromEnv().IsConfigured())
	assert.False(t, shouldSkipLegacyRobotRoutingForClowder())
}
