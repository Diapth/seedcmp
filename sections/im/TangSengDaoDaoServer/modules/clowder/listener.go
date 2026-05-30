package clowder

import "github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"

type InboundForwarder interface {
	ForwardInbound(message InboundMessage) (RouteResponse, error)
}

type GroupRoleResolver func(groupNo string, uid string) (*GroupRoleSnapshot, error)

func (c *Clowder) MessagesListen(messages []*config.MessageResp, forwarder InboundForwarder) {
	c.MessagesListenWithRoles(messages, forwarder, nil)
}

func (c *Clowder) MessagesListenWithRoles(messages []*config.MessageResp, forwarder InboundForwarder, resolveRole GroupRoleResolver) {
	if forwarder == nil || !c.config.IsConfigured() {
		return
	}

	for _, message := range messages {
		var role *GroupRoleSnapshot
		if resolveRole != nil && message.ChannelType == 2 {
			resolved, err := resolveRole(message.ChannelID, message.FromUID)
			if err != nil {
				c.Warn("resolve clowder group role failed")
			} else {
				role = resolved
			}
		}
		normalized, err := NormalizeInboundMessage(RawIMMessage{
			ChannelID:   message.ChannelID,
			ChannelType: message.ChannelType,
			FromUID:     message.FromUID,
			MessageID:   message.MessageIDStr,
			ClientMsgNo: message.ClientMsgNo,
			MessageSeq:  message.MessageSeq,
			Timestamp:   int64(message.Timestamp),
			Payload:     message.Payload,
			Role:        role,
		})
		if err != nil {
			c.Warn("normalize clowder inbound message failed")
			continue
		}
		_, _ = forwarder.ForwardInbound(normalized)
	}
}
