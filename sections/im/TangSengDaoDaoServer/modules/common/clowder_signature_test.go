package common

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSignClowderPayloadIsStable(t *testing.T) {
	body := []byte(`{"connectorId":"im-web","messageId":"m1"}`)
	signature := SignClowderPayload(body, "secret", "1780000000000")

	assert.Equal(t, "af080adb760b5268e67e5237bdcc06763125cb38b23ed076daef62c67d15f5e5", signature)
}

func TestVerifyClowderSignatureAcceptsValidSignature(t *testing.T) {
	body := []byte(`{"connectorId":"im-web","messageId":"m1"}`)
	timestamp := "1780000000000"
	signature := SignClowderPayload(body, "secret", timestamp)

	err := VerifyClowderSignature(body, "secret", timestamp, signature, time.UnixMilli(1780000001000), 5*time.Minute)

	require.NoError(t, err)
}

func TestVerifyClowderSignatureRejectsInvalidSignature(t *testing.T) {
	body := []byte(`{"connectorId":"im-web","messageId":"m1"}`)

	err := VerifyClowderSignature(body, "secret", "1780000000000", "bad-signature", time.UnixMilli(1780000001000), 5*time.Minute)

	require.Error(t, err)
	assert.ErrorContains(t, err, "invalid clowder signature")
}

func TestVerifyClowderSignatureRejectsStaleTimestamp(t *testing.T) {
	body := []byte(`{"connectorId":"im-web","messageId":"m1"}`)
	timestamp := "1780000000000"
	signature := SignClowderPayload(body, "secret", timestamp)

	err := VerifyClowderSignature(body, "secret", timestamp, signature, time.UnixMilli(1780000601000), 5*time.Minute)

	require.Error(t, err)
	assert.ErrorContains(t, err, "stale clowder signature timestamp")
}

func TestDefaultClowderBridgeConfig(t *testing.T) {
	config := DefaultClowderBridgeConfig()

	assert.Equal(t, "im-web", config.ConnectorID)
	assert.Equal(t, 5*time.Second, config.RequestTimeout)
	assert.Equal(t, 5*time.Minute, config.SignatureTolerance)
	assert.False(t, config.Enabled)
	assert.False(t, config.IsConfigured())
}
