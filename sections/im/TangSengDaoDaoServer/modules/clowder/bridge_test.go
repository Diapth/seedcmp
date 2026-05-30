package clowder

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeInboundMessageBuildsExternalChatAndSender(t *testing.T) {
	payload := []byte(`{"type":1,"content":"@codex summarize","mention":{"uids":["codex"]}}`)
	msg := RawIMMessage{
		ChannelID:   "group_123",
		ChannelType: 2,
		FromUID:     "u_10001",
		FromName:    "Alice",
		MessageID:   "987654321",
		ClientMsgNo: "client-abc",
		MessageSeq:  42,
		Timestamp:   1780000000000,
		Payload:     payload,
		ChatName:    "Product Group",
		Role:        &GroupRoleSnapshot{GroupNo: "group_123", UID: "u_10001", Role: GroupRoleManager, Admin: true},
	}

	normalized, err := NormalizeInboundMessage(msg)

	require.NoError(t, err)
	assert.Equal(t, "im-web", normalized.ConnectorID)
	assert.Equal(t, "2:group_123", normalized.ExternalChatID)
	assert.Equal(t, "group", normalized.ChatType)
	assert.Equal(t, "@codex summarize", normalized.Text)
	assert.Equal(t, []string{"codex"}, normalized.Mentions)
	assert.Equal(t, "u_10001", normalized.Sender.ID)
	assert.Equal(t, "Alice", normalized.Sender.Name)
	require.NotNil(t, normalized.Role)
	assert.Equal(t, GroupRoleManager, normalized.Role.Role)
	assert.True(t, normalized.Role.Admin)
	assert.Equal(t, "987654321", normalized.MessageID)
	assert.Equal(t, "client-abc", normalized.ClientMsgNo)
}

func TestNormalizeInboundMessageFallsBackToPayloadString(t *testing.T) {
	normalized, err := NormalizeInboundMessage(RawIMMessage{
		ChannelID:   "u_2",
		ChannelType: 1,
		FromUID:     "u_1",
		MessageID:   "m1",
		ClientMsgNo: "c1",
		Payload:     []byte("plain text"),
	})

	require.NoError(t, err)
	assert.Equal(t, "1:u_2", normalized.ExternalChatID)
	assert.Equal(t, "direct", normalized.ChatType)
	assert.Equal(t, "plain text", normalized.Text)
}

func TestNormalizeInboundMessageMapsAttachments(t *testing.T) {
	payload := map[string]interface{}{
		"type": 2,
		"url":  "https://im.example/image.png",
		"name": "image.png",
		"size": 12345,
	}
	body, err := json.Marshal(payload)
	require.NoError(t, err)

	normalized, err := NormalizeInboundMessage(RawIMMessage{
		ChannelID:   "group_123",
		ChannelType: 2,
		FromUID:     "u_1",
		MessageID:   "m1",
		ClientMsgNo: "c1",
		Payload:     body,
	})

	require.NoError(t, err)
	require.Len(t, normalized.Attachments, 1)
	assert.Equal(t, "image", normalized.Attachments[0].Type)
	assert.Equal(t, "https://im.example/image.png", normalized.Attachments[0].URL)
	assert.Equal(t, "image.png", normalized.Attachments[0].FileName)
	assert.Equal(t, int64(12345), normalized.Attachments[0].Size)
}

func TestStableStreamClientMsgNo(t *testing.T) {
	assert.Equal(t, "platform-1", StableStreamClientMsgNo("invoke-1", "platform-1"))
	assert.Equal(t, "clowder-stream-invoke-1", StableStreamClientMsgNo("invoke-1", ""))
}
