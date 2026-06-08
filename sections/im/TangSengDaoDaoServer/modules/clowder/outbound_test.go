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
	}

	req, err := BuildOutboundMessage(payload)

	require.NoError(t, err)
	assert.Equal(t, "clowder_ai", req.ChannelID)
	assert.Equal(t, common.ChannelTypePerson.Uint8(), req.ChannelType)
	assert.Equal(t, "clowder:codex", req.FromUID)
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

func TestInboundPromptBuildsPersistedUserTextMessage(t *testing.T) {
	req, err := BuildInboundPersistMessage(conversationRefRequest{
		ChannelID:   "clowder_cat:opus",
		ChannelType: common.ChannelTypePerson.Uint8(),
		Text:        "请用一句话回复",
		DirectCatID: "opus",
	}, "user-1")

	require.NoError(t, err)
	assert.Equal(t, "clowder_cat:opus", req.ChannelID)
	assert.Equal(t, common.ChannelTypePerson.Uint8(), req.ChannelType)
	assert.Equal(t, "user-1", req.FromUID)
	assert.Equal(t, 1, req.Header.RedDot)
	assert.Equal(t, 0, req.Header.NoPersist)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(req.Payload, &body))
	assert.Equal(t, float64(common.Text), body["type"])
	assert.Equal(t, "请用一句话回复", body["content"])
	assert.Equal(t, "请用一句话回复", body["text"])
	assert.Equal(t, "im-web", body["connector_id"])
	assert.Equal(t, "clowder_user_prompt", body["source"])
	assert.Equal(t, "opus", body["direct_cat_id"])
	assert.NotContains(t, body["content"], "@opus")
}

func TestOutboundPayloadBuildsImageMessage(t *testing.T) {
	payload := OutboundPayload{
		ConnectorID:    ConnectorID,
		ExternalChatID: "1:clowder_ai",
		CatID:          "ragdoll-kn9a",
		CatDisplayName: "布偶猫",
		Content:        "y = sin(x) 函数图像",
		Media: &OutboundMediaPayload{
			Type:     "image",
			URL:      "http://100.79.157.76:3003/api/connector-media/sinx.png",
			FileName: "sinx.png",
			Size:     4096,
		},
	}

	req, err := BuildOutboundMessage(payload)

	require.NoError(t, err)
	assert.Equal(t, "clowder_ai", req.ChannelID)
	assert.Equal(t, common.ChannelTypePerson.Uint8(), req.ChannelType)
	assert.Equal(t, "clowder:ragdoll-kn9a", req.FromUID)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(req.Payload, &body))
	assert.Equal(t, float64(common.Image), body["type"])
	assert.Equal(t, "http://100.79.157.76:3003/api/connector-media/sinx.png", body["url"])
	assert.Equal(t, "sinx.png", body["name"])
	assert.Equal(t, "y = sin(x) 函数图像", body["content"])
	assert.Equal(t, "im-web", body["connector_id"])
	assert.Equal(t, "ragdoll-kn9a", body["cat_id"])
	assert.Equal(t, "布偶猫", body["cat_display_name"])
}

func TestOutboundPayloadBuildsFileMessage(t *testing.T) {
	payload := OutboundPayload{
		ConnectorID:    ConnectorID,
		ExternalChatID: "2:group-cat-cafe",
		CatID:          "codex",
		CatDisplayName: "Codex",
		Content:        "我整理了一份会议纪要。",
		Media: &OutboundMediaPayload{
			Type:     "file",
			URL:      "http://100.79.157.76:3003/api/connector-media/notes.md",
			FileName: "notes.md",
			Size:     2048,
		},
	}

	req, err := BuildOutboundMessage(payload)

	require.NoError(t, err)
	assert.Equal(t, "group-cat-cafe", req.ChannelID)
	assert.Equal(t, common.ChannelTypeGroup.Uint8(), req.ChannelType)
	assert.Equal(t, "clowder:codex", req.FromUID)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(req.Payload, &body))
	assert.Equal(t, float64(common.File), body["type"])
	assert.Equal(t, "http://100.79.157.76:3003/api/connector-media/notes.md", body["url"])
	assert.Equal(t, "notes.md", body["name"])
	assert.Equal(t, "我整理了一份会议纪要。", body["content"])
	assert.Equal(t, "im-web", body["connector_id"])
	assert.Equal(t, "codex", body["cat_id"])
	assert.Equal(t, "Codex", body["cat_display_name"])
}

func TestApplyGroupOutboundSubscribersForVirtualCatGroupMessage(t *testing.T) {
	payload := OutboundPayload{
		ConnectorID:    ConnectorID,
		ExternalChatID: "2:group-cat-cafe",
		CatID:          "codex",
		CatDisplayName: "Codex",
		Content:        "我在群里回复。",
		Format:         "markdown",
	}
	req, err := BuildOutboundMessage(payload)
	require.NoError(t, err)

	applied := applyGroupOutboundSubscribers(req, []string{"creator", "clowder:codex", "", "member", "creator"})

	require.True(t, applied)
	assert.Equal(t, "creator", req.FromUID)
	assert.Equal(t, common.ChannelTypeGroup.Uint8(), req.ChannelType)
	assert.Empty(t, req.Subscribers)
}

func TestOutboundPayloadBuildsVirtualClowderDirectMessageForUser(t *testing.T) {
	userID := "u_1"
	payload := OutboundPayload{
		ConnectorID:    ConnectorID,
		ExternalChatID: "1:" + common.GetFakeChannelIDWith(userID, "clowder_ai"),
		CatID:          "codex",
		Content:        "处理中...",
		Format:         "markdown",
	}

	req, err := BuildOutboundMessage(payload)

	require.NoError(t, err)
	assert.Equal(t, userID, req.ChannelID)
	assert.Equal(t, common.ChannelTypePerson.Uint8(), req.ChannelType)
	assert.Equal(t, "clowder_ai", req.FromUID)
}

func TestOutboundPayloadBuildsVirtualClowderCatDirectMessageForUser(t *testing.T) {
	userID := "u_1"
	catChannelID := "clowder_cat:opus"
	payload := OutboundPayload{
		ConnectorID:    ConnectorID,
		ExternalChatID: "1:" + common.GetFakeChannelIDWith(userID, catChannelID),
		CatID:          "opus",
		CatDisplayName: "布偶猫",
		Content:        "收到，可以在单独会话里响应。",
		Format:         "markdown",
	}

	req, err := BuildOutboundMessage(payload)

	require.NoError(t, err)
	assert.Equal(t, userID, req.ChannelID)
	assert.Equal(t, common.ChannelTypePerson.Uint8(), req.ChannelType)
	assert.Equal(t, catChannelID, req.FromUID)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(req.Payload, &body))
	assert.Equal(t, "opus", body["cat_id"])
	assert.Equal(t, "布偶猫", body["cat_display_name"])
	assert.Equal(t, "im-web", body["connector_id"])
}

func TestOutboundPayloadKeepsVirtualCatDirectWhenDefaultRecipientConfigured(t *testing.T) {
	userID := "u_1"
	catChannelID := "clowder_cat:opus"
	req, err := BuildOutboundMessageWithDefaultRecipient(OutboundPayload{
		ConnectorID:    ConnectorID,
		ExternalChatID: "1:" + common.GetFakeChannelIDWith(userID, catChannelID),
		CatID:          "opus",
		CatDisplayName: "布偶猫",
		Content:        "应该回到布偶猫直聊。",
		Format:         "markdown",
	}, "default-owner")

	require.NoError(t, err)
	assert.Equal(t, userID, req.ChannelID)
	assert.Equal(t, common.ChannelTypePerson.Uint8(), req.ChannelType)
	assert.Equal(t, catChannelID, req.FromUID)
}

func TestOutboundPayloadUsesReplySenderForDirectMessage(t *testing.T) {
	payload := OutboundPayload{
		ConnectorID:    ConnectorID,
		ExternalChatID: "1:clowder_ai",
		CatID:          "codex",
		Content:        "hello from clowder",
		Format:         "markdown",
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

func TestOutboundPayloadBuildsSilentReactionEvent(t *testing.T) {
	payload := OutboundPayload{
		ConnectorID:    ConnectorID,
		ExternalChatID: "2:group-cat-cafe",
		Reaction: &OutboundReactionPayload{
			PlatformMessageID: "user-message-1",
			Emoji:             "❤️",
			EmojiType:         "HEART",
		},
	}

	req, err := BuildOutboundMessage(payload)

	require.NoError(t, err)
	assert.Equal(t, "group-cat-cafe", req.ChannelID)
	assert.Equal(t, common.ChannelTypeGroup.Uint8(), req.ChannelType)
	assert.Equal(t, clowderAIDirectChannelID, req.FromUID)
	assert.Equal(t, 1, req.Header.NoPersist)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(req.Payload, &body))
	assert.Equal(t, float64(1000), body["type"])
	assert.Equal(t, "clowder_reaction", body["event"])
	assert.Equal(t, "user-message-1", body["target_message_id"])
	assert.Equal(t, "❤️", body["emoji"])
	assert.Equal(t, true, body["silent"])
}

func TestVirtualClowderExternalChatIDIncludesUserFakeChannel(t *testing.T) {
	userID := "u_1"

	got := externalChatIDForUser("clowder_ai", common.ChannelTypePerson.Uint8(), userID)

	assert.Equal(t, "1:"+common.GetFakeChannelIDWith(userID, "clowder_ai"), got)
	assert.Equal(t, "1:"+common.GetFakeChannelIDWith(userID, "clowder_cat:opus"), externalChatIDForUser("clowder_cat:opus", common.ChannelTypePerson.Uint8(), userID))
	assert.Equal(t, "2:group-clowder", externalChatIDForUser("group-clowder", common.ChannelTypeGroup.Uint8(), userID))
}

func TestVirtualClowderUserUpsertProvidesNonNullUserLookupFields(t *testing.T) {
	sql, args := virtualClowderUserUpsert()

	assert.Contains(t, sql, "phone,zone")
	assert.Contains(t, sql, "phone=VALUES(phone)")
	assert.Contains(t, sql, "zone=VALUES(zone)")
	assert.Contains(t, args, "13000021001")
	assert.Contains(t, args, "0086")
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
