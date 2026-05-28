package clowder

import "github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"

type InboundForwarder interface {
	ForwardInbound(message InboundMessage) (RouteResponse, error)
}

func (c *Clowder) MessagesListen(messages []*config.MessageResp, forwarder InboundForwarder) {
	if forwarder == nil || !c.config.IsConfigured() {
		return
	}

	for _, message := range messages {
		normalized, err := NormalizeInboundMessage(RawIMMessage{
			ChannelID:   message.ChannelID,
			ChannelType: message.ChannelType,
			FromUID:     message.FromUID,
			MessageID:   message.MessageIDStr,
			ClientMsgNo: message.ClientMsgNo,
			MessageSeq:  message.MessageSeq,
			Timestamp:   int64(message.Timestamp),
			Payload:     message.Payload,
		})
		if err != nil {
			c.Warn("normalize clowder inbound message failed")
			continue
		}
		_, _ = forwarder.ForwardInbound(normalized)
	}
}
