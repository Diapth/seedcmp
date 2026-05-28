package clowder

import (
	"testing"

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
