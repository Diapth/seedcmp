package clowder

import (
	"encoding/json"
	"testing"

	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOutboundPayloadBuildsDirectMarkdownMessage(t *testing.T) {
	payload := OutboundPayload{
		ConnectorID:       ConnectorID,
		ExternalChatID:    "1:clowder_ai",
		CatID:             "codex",
		CatDisplayName:    "Codex",
		Content:           "可用智能体: Codex",
		Format:            "markdown",
		InvocationID:      "invoke-1",
		PlatformMessageID: "platform-1",
		Metadata: map[string]interface{}{
			"replyToSender": map[string]interface{}{
				"id": "u_10001",
			},
		},
	}

	req, err := BuildOutboundMessage(payload)

	require.NoError(t, err)
	assert.Equal(t, "u_10001", req.ChannelID)
	assert.Equal(t, common.ChannelTypePerson.Uint8(), req.ChannelType)
	assert.Equal(t, "clowder_ai", req.FromUID)
	assert.Equal(t, 1, req.Header.RedDot)
	assert.Equal(t, 0, req.Header.NoPersist)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(req.Payload, &body))
	assert.Equal(t, float64(common.Text), body["type"])
	assert.Equal(t, "可用智能体: Codex", body["content"])
	assert.Equal(t, "可用智能体: Codex", body["text"])
	assert.Equal(t, "markdown", body["format"])
	assert.Equal(t, true, body["markdown"])
	assert.Equal(t, true, body["ai"])
	assert.Equal(t, "codex", body["cat_id"])
	assert.Equal(t, "Codex", body["cat_display_name"])
	assert.Equal(t, "invoke-1", body["invocation_id"])
}

func TestOutboundPayloadUsesDefaultRecipientForDirectMessageWithoutSenderMetadata(t *testing.T) {
	req, err := BuildOutboundMessageWithDefaultRecipient(OutboundPayload{
		ConnectorID:    ConnectorID,
		ExternalChatID: "1:clowder_ai",
		Content:        "hello from clowder",
		Format:         "markdown",
	}, "18337488675")

	require.NoError(t, err)
	assert.Equal(t, "18337488675", req.ChannelID)
	assert.Equal(t, common.ChannelTypePerson.Uint8(), req.ChannelType)
	assert.Equal(t, "clowder_ai", req.FromUID)
}

func TestOutboundPayloadRejectsInvalidExternalChat(t *testing.T) {
	_, err := BuildOutboundMessage(OutboundPayload{
		ConnectorID:    ConnectorID,
		ExternalChatID: "clowder_ai",
		Content:        "hello",
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid externalChatId")
}
