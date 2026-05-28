package common

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type ClowderBridgeConfig struct {
	Enabled            bool
	APIBaseURL         string
	ConnectorID        string
	ConnectorSecret    string
	DefaultOwnerUserID string
	RequestTimeout     time.Duration
	SignatureTolerance time.Duration
}

func DefaultClowderBridgeConfig() ClowderBridgeConfig {
	return ClowderBridgeConfig{
		Enabled:            false,
		ConnectorID:        "im-web",
		RequestTimeout:     5 * time.Second,
		SignatureTolerance: 5 * time.Minute,
	}
}

func ClowderBridgeConfigFromEnv() ClowderBridgeConfig {
	cfg := DefaultClowderBridgeConfig()
	cfg.Enabled = strings.EqualFold(strings.TrimSpace(os.Getenv("IM_WEB_CLOWDER_ENABLED")), "true")
	cfg.APIBaseURL = strings.TrimSpace(os.Getenv("CLOWDER_API_BASE_URL"))
	if connectorID := strings.TrimSpace(os.Getenv("CLOWDER_CONNECTOR_ID")); connectorID != "" {
		cfg.ConnectorID = connectorID
	}
	cfg.ConnectorSecret = strings.TrimSpace(os.Getenv("CLOWDER_CONNECTOR_SECRET"))
	cfg.DefaultOwnerUserID = strings.TrimSpace(os.Getenv("CLOWDER_DEFAULT_OWNER_USER_ID"))
	if timeout := envDurationMillis("CLOWDER_REQUEST_TIMEOUT_MS"); timeout > 0 {
		cfg.RequestTimeout = timeout
	}
	if tolerance := envDurationMillis("CLOWDER_SIGNATURE_TOLERANCE_MS"); tolerance > 0 {
		cfg.SignatureTolerance = tolerance
	}
	return cfg
}

func envDurationMillis(key string) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return 0
	}
	millis, err := strconv.Atoi(raw)
	if err != nil || millis <= 0 {
		return 0
	}
	return time.Duration(millis) * time.Millisecond
}

func (c ClowderBridgeConfig) IsConfigured() bool {
	return c.Enabled &&
		c.APIBaseURL != "" &&
		c.ConnectorID != "" &&
		c.ConnectorSecret != "" &&
		c.DefaultOwnerUserID != ""
}
