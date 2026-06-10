package clowder

import (
	"testing"

	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/common"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type recordingForwarder struct {
	messages []InboundMessage
}

func (r *recordingForwarder) ForwardInbound(message InboundMessage) (RouteResponse, error) {
	r.messages = append(r.messages, message)
	return RouteResponse{Kind: "routed", ThreadID: "thread-1", MessageID: "msg-1"}, nil
}

func TestMessagesListenForwardsConfiguredMessages(t *testing.T) {
	bridge := New(config.NewContext(config.New()))
	bridge.config.Enabled = true
	bridge.config.APIBaseURL = "http://127.0.0.1:3000"
	bridge.config.ConnectorSecret = "shared-secret"
	bridge.config.DefaultOwnerUserID = "owner-1"
	forwarder := &recordingForwarder{}

	bridge.MessagesListen([]*config.MessageResp{{
		ChannelID:    "group-clowder",
		ChannelType:  2,
		FromUID:      "u_10001",
		MessageIDStr: "m1",
		ClientMsgNo:  "c1",
		MessageSeq:   11,
		Timestamp:    1780000000,
		Payload:      []byte(`{"type":1,"content":"@codex hello"}`),
	}}, forwarder)

	require.Len(t, forwarder.messages, 1)
	assert.Equal(t, "2:group-clowder", forwarder.messages[0].ExternalChatID)
	assert.Equal(t, "@codex hello", forwarder.messages[0].Text)
	assert.Equal(t, "u_10001", forwarder.messages[0].Sender.ID)
}

func TestMessagesListenUsesCanonicalExternalChatForVirtualDirect(t *testing.T) {
	bridge := New(config.NewContext(config.New()))
	bridge.config.Enabled = true
	bridge.config.APIBaseURL = "http://127.0.0.1:3000"
	bridge.config.ConnectorSecret = "shared-secret"
	bridge.config.DefaultOwnerUserID = "owner-1"
	forwarder := &recordingForwarder{}

	bridge.MessagesListen([]*config.MessageResp{{
		ChannelID:    "clowder_cat:coordinator",
		ChannelType:  common.ChannelTypePerson.Uint8(),
		FromUID:      "u_10001",
		MessageIDStr: "m1",
		ClientMsgNo:  "c1",
		MessageSeq:   11,
		Timestamp:    1780000000,
		Payload:      []byte(`{"type":1,"content":"请创建任务"}`),
	}}, forwarder)

	require.Len(t, forwarder.messages, 1)
	assert.Equal(t, "1:"+common.GetFakeChannelIDWith("u_10001", "clowder_cat:coordinator"), forwarder.messages[0].ExternalChatID)
}

func TestMessagesListenWithRolesAddsGroupRoleSnapshot(t *testing.T) {
	bridge := New(config.NewContext(config.New()))
	bridge.config.Enabled = true
	bridge.config.APIBaseURL = "http://127.0.0.1:3000"
	bridge.config.ConnectorSecret = "shared-secret"
	bridge.config.DefaultOwnerUserID = "owner-1"
	forwarder := &recordingForwarder{}

	bridge.MessagesListenWithRoles([]*config.MessageResp{{
		ChannelID:    "group-clowder",
		ChannelType:  2,
		FromUID:      "manager-1",
		MessageIDStr: "m1",
		ClientMsgNo:  "c1",
		MessageSeq:   11,
		Timestamp:    1780000000,
		Payload:      []byte(`{"type":1,"content":"@codex hello"}`),
	}}, forwarder, func(groupNo string, uid string) (*GroupRoleSnapshot, error) {
		return &GroupRoleSnapshot{GroupNo: groupNo, UID: uid, Role: GroupRoleManager, Admin: true}, nil
	})

	require.Len(t, forwarder.messages, 1)
	require.NotNil(t, forwarder.messages[0].Role)
	assert.Equal(t, "group-clowder", forwarder.messages[0].Role.GroupNo)
	assert.Equal(t, "manager-1", forwarder.messages[0].Role.UID)
	assert.Equal(t, GroupRoleManager, forwarder.messages[0].Role.Role)
	assert.True(t, forwarder.messages[0].Role.Admin)
}

func TestMessagesListenRoutesConfiguredGroupToPmWhenAutoReplyEnabled(t *testing.T) {
	bridge := New(config.NewContext(config.New()))
	bridge.config.Enabled = true
	bridge.config.APIBaseURL = "http://127.0.0.1:3000"
	bridge.config.ConnectorSecret = "shared-secret"
	bridge.config.DefaultOwnerUserID = "owner-1"
	bridge.storeGroupCats(groupCatSyncRequest{
		GroupID:          "group-clowder",
		GroupName:        "项目群",
		CatIDs:           []string{"coordinator", "xianxian"},
		Prompt:           "项目群上下文",
		ProactiveReplies: true,
		ProjectThreadID:  "thread-project-1",
	})
	forwarder := &recordingForwarder{}

	bridge.MessagesListen([]*config.MessageResp{{
		ChannelID:    "group-clowder",
		ChannelType:  2,
		FromUID:      "u_10001",
		MessageIDStr: "m1",
		ClientMsgNo:  "c1",
		MessageSeq:   11,
		Timestamp:    1780000000,
		Payload:      []byte(`{"type":1,"content":"这个需求怎么拆？"}`),
	}}, forwarder)

	require.Len(t, forwarder.messages, 1)
	assert.Equal(t, []string{"coordinator"}, forwarder.messages[0].TargetCatIDs)
	assert.Equal(t, "项目群上下文", forwarder.messages[0].PromptContext)
	assert.Equal(t, "thread-project-1", forwarder.messages[0].ThreadID)
}

func TestMessagesListenSkipsClowderVirtualSenders(t *testing.T) {
	bridge := New(config.NewContext(config.New()))
	bridge.config.Enabled = true
	bridge.config.APIBaseURL = "http://127.0.0.1:3000"
	bridge.config.ConnectorSecret = "shared-secret"
	bridge.config.DefaultOwnerUserID = "owner-1"
	forwarder := &recordingForwarder{}

	bridge.MessagesListen([]*config.MessageResp{{
		ChannelID:    "group-clowder",
		ChannelType:  2,
		FromUID:      "clowder:coordinator",
		MessageIDStr: "m1",
		ClientMsgNo:  "c1",
		MessageSeq:   11,
		Timestamp:    1780000000,
		Payload:      []byte(`{"type":1,"content":"我来拆一下任务"}`),
	}}, forwarder)

	assert.Empty(t, forwarder.messages)
}
