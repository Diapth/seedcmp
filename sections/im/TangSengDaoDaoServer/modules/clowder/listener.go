package clowder

import (
	"strings"

	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
)

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
		if isClowderVirtualSenderUID(message.FromUID) {
			continue
		}
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
		normalized = c.enrichGroupAutoReplyRouting(normalized)
		_, _ = forwarder.ForwardInbound(normalized)
	}
}

func (c *Clowder) enrichGroupAutoReplyRouting(message InboundMessage) InboundMessage {
	if message.ChannelType != 2 {
		return message
	}
	if strings.TrimSpace(message.DirectCatID) != "" || len(cleanStringList(message.TargetCatIDs)) > 0 {
		return message
	}
	state, ok := c.loadGroupCats(message.ChannelID)
	if !ok || state.AutoReplyMode != "soft_mentions" {
		return message
	}
	targets := preferredGroupAutoReplyTargets(state)
	if len(targets) == 0 {
		return message
	}
	message.TargetCatIDs = targets
	if strings.TrimSpace(message.PromptContext) == "" {
		message.PromptContext = strings.TrimSpace(state.Prompt)
	}
	if strings.TrimSpace(message.ThreadID) == "" {
		message.ThreadID = strings.TrimSpace(state.ProjectThreadID)
	}
	return message
}

func preferredGroupAutoReplyTargets(state groupCatSyncResponse) []string {
	ids := cleanStringList(state.CatIDs)
	for _, id := range ids {
		if normalizeCatLookup(id) == "coordinator" || normalizeCatLookup(id) == "pm" {
			return []string{id}
		}
	}
	for _, cat := range state.Cats {
		id := strings.TrimSpace(cat.CatID)
		if normalizeCatLookup(id) == "coordinator" || normalizeCatLookup(id) == "pm" {
			return []string{id}
		}
	}
	if len(ids) > 0 {
		return []string{ids[0]}
	}
	for _, cat := range state.Cats {
		id := strings.TrimSpace(cat.CatID)
		if id != "" {
			return []string{id}
		}
	}
	return nil
}
