package common

import "time"

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

func (c ClowderBridgeConfig) IsConfigured() bool {
	return c.Enabled &&
		c.APIBaseURL != "" &&
		c.ConnectorID != "" &&
		c.ConnectorSecret != "" &&
		c.DefaultOwnerUserID != ""
}
