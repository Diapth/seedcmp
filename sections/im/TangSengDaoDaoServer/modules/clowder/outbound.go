package clowder

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/common"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
)

type OutboundPayload struct {
	ConnectorID       string                   `json:"connectorId"`
	ExternalChatID    string                   `json:"externalChatId"`
	ThreadID          string                   `json:"threadId,omitempty"`
	InvocationID      string                   `json:"invocationId,omitempty"`
	CatID             string                   `json:"catId,omitempty"`
	CatDisplayName    string                   `json:"catDisplayName,omitempty"`
	Content           string                   `json:"content"`
	Format            string                   `json:"format"`
	RichBlocks        []map[string]interface{} `json:"richBlocks,omitempty"`
	Media             *OutboundMediaPayload    `json:"media,omitempty"`
	Reaction          *OutboundReactionPayload `json:"reaction,omitempty"`
	Origin            map[string]interface{}   `json:"origin,omitempty"`
	Stream            *OutboundStreamState     `json:"stream,omitempty"`
	Metadata          map[string]interface{}   `json:"metadata,omitempty"`
	PlatformMessageID string                   `json:"platformMessageId,omitempty"`
}

type OutboundReactionPayload struct {
	PlatformMessageID string `json:"platformMessageId"`
	Emoji             string `json:"emoji"`
	EmojiType         string `json:"emojiType,omitempty"`
}

type OutboundMediaPayload struct {
	Type     string `json:"type"`
	URL      string `json:"url"`
	FileName string `json:"fileName,omitempty"`
	Size     int64  `json:"size,omitempty"`
	Alt      string `json:"alt,omitempty"`
}

type OutboundStreamState struct {
	State             string `json:"state"`
	PlatformMessageID string `json:"platformMessageId,omitempty"`
}

func BuildOutboundMessage(payload OutboundPayload) (*config.MsgSendReq, error) {
	return BuildOutboundMessageWithDefaultRecipient(payload, "")
}

func BuildOutboundMessageWithDefaultRecipient(payload OutboundPayload, defaultRecipientUID string) (*config.MsgSendReq, error) {
	channelType, channelID, err := parseExternalChatID(payload.ExternalChatID)
	if err != nil {
		return nil, err
	}
	directRecipientUID := ""
	directVirtualSenderUID := ""
	if channelType == common.ChannelTypePerson.Uint8() {
		if common.IsFakeChannel(channelID) {
			uids := strings.Split(channelID, "@")
			if len(uids) == 2 {
				if isClowderVirtualDirectChannelID(uids[0]) {
					directVirtualSenderUID = uids[0]
					directRecipientUID = uids[1]
				} else if isClowderVirtualDirectChannelID(uids[1]) {
					directVirtualSenderUID = uids[1]
					directRecipientUID = uids[0]
				}
			}
		} else {
			if isClowderVirtualDirectChannelID(channelID) {
				directVirtualSenderUID = channelID
			}
			directRecipientUID = outboundDirectRecipientUID(payload, defaultRecipientUID)
		}
	}
	if payload.Reaction != nil {
		return buildOutboundReactionEvent(payload, channelType, channelID, directRecipientUID, directVirtualSenderUID)
	}
	content := strings.TrimSpace(payload.Content)
	if content == "" && payload.Stream != nil && payload.Stream.State == "cleanup" {
		return nil, ErrOutboundNoop
	}
	if content == "" && payload.Media == nil {
		return nil, errors.New("empty clowder outbound content")
	}

	format := strings.TrimSpace(payload.Format)
	if format == "" {
		format = "markdown"
	}
	fromUID := clowderAIDirectChannelID
	if catID := strings.TrimSpace(payload.CatID); catID != "" {
		fromUID = "clowder:" + catID
	}
	if directRecipientUID != "" {
		channelID = directRecipientUID
		fromUID = clowderAIDirectChannelID
		if directVirtualSenderUID != "" {
			fromUID = directVirtualSenderUID
		}
	}
	platformMessageID := payload.PlatformMessageID
	if payload.Stream != nil && payload.Stream.PlatformMessageID != "" {
		platformMessageID = payload.Stream.PlatformMessageID
	}
	body := buildOutboundMessageBody(payload, content, format)
	if payload.ThreadID != "" {
		body["thread_id"] = payload.ThreadID
	}
	if payload.InvocationID != "" {
		body["invocation_id"] = payload.InvocationID
	}
	if payload.CatID != "" {
		body["cat_id"] = payload.CatID
	}
	if payload.CatDisplayName != "" {
		body["cat_display_name"] = payload.CatDisplayName
	}
	if platformMessageID != "" {
		body["platform_message_id"] = platformMessageID
		body["client_msg_no"] = StableStreamClientMsgNo(payload.InvocationID, platformMessageID)
	}
	if payload.Stream != nil {
		body["stream"] = map[string]interface{}{
			"state":               payload.Stream.State,
			"platformMessageId":   payload.Stream.PlatformMessageID,
			"platform_message_id": payload.Stream.PlatformMessageID,
		}
		body["streaming"] = payload.Stream.State == "placeholder" || payload.Stream.State == "chunk"
	}
	if len(payload.RichBlocks) > 0 {
		body["rich_blocks"] = payload.RichBlocks
	}
	if payload.Metadata != nil {
		body["metadata"] = payload.Metadata
	}
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	return &config.MsgSendReq{
		Header: config.MsgHeader{
			RedDot: 1,
		},
		ChannelID:   channelID,
		ChannelType: channelType,
		FromUID:     fromUID,
		Payload:     bodyBytes,
	}, nil
}

func buildOutboundReactionEvent(payload OutboundPayload, channelType uint8, channelID string, directRecipientUID string, directVirtualSenderUID string) (*config.MsgSendReq, error) {
	reaction := payload.Reaction
	if reaction == nil {
		return nil, errors.New("empty clowder outbound reaction")
	}
	targetMessageID := strings.TrimSpace(reaction.PlatformMessageID)
	if targetMessageID == "" {
		return nil, errors.New("empty clowder outbound reaction message id")
	}
	if directRecipientUID != "" {
		channelID = directRecipientUID
	}
	fromUID := clowderAIDirectChannelID
	if directVirtualSenderUID != "" {
		fromUID = directVirtualSenderUID
	}
	emoji := strings.TrimSpace(reaction.Emoji)
	if emoji == "" {
		emoji = strings.TrimSpace(reaction.EmojiType)
	}
	if emoji == "" {
		emoji = "❤️"
	}
	body := map[string]interface{}{
		"type":              1000,
		"event":             "clowder_reaction",
		"target_message_id": targetMessageID,
		"message_id":        targetMessageID,
		"emoji":             emoji,
		"emoji_type":        strings.TrimSpace(reaction.EmojiType),
		"user_id":           "clowder",
		"user_name":         "Clowder AI",
		"connector_id":      ConnectorID,
		"silent":            true,
	}
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	return &config.MsgSendReq{
		Header: config.MsgHeader{
			NoPersist: 1,
			RedDot:   0,
		},
		ChannelID:   channelID,
		ChannelType: channelType,
		FromUID:     fromUID,
		Payload:     bodyBytes,
	}, nil
}

func applyGroupOutboundSubscribers(req *config.MsgSendReq, subscribers []string) bool {
	if req == nil || req.ChannelType != common.ChannelTypeGroup.Uint8() || !isClowderVirtualSenderUID(req.FromUID) {
		return false
	}
	seen := map[string]struct{}{}
	realSubscribers := make([]string, 0, len(subscribers))
	for _, subscriber := range subscribers {
		uid := strings.TrimSpace(subscriber)
		if uid == "" || isClowderVirtualSenderUID(uid) {
			continue
		}
		if _, ok := seen[uid]; ok {
			continue
		}
		seen[uid] = struct{}{}
		realSubscribers = append(realSubscribers, uid)
	}
	if len(realSubscribers) == 0 {
		return false
	}
	req.FromUID = realSubscribers[0]
	req.Subscribers = nil
	return true
}

func outboundDirectRecipientUID(payload OutboundPayload, defaultRecipientUID string) string {
	for _, key := range []string{"replyToSender", "reply_to_sender"} {
		if value, ok := payload.Metadata[key]; ok {
			if uid := nestedString(value, "id", "uid", "userId", "user_id"); uid != "" {
				return uid
			}
		}
	}
	return strings.TrimSpace(defaultRecipientUID)
}

func nestedString(value interface{}, keys ...string) string {
	switch typed := value.(type) {
	case map[string]interface{}:
		for _, key := range keys {
			if raw, ok := typed[key]; ok {
				if text := strings.TrimSpace(fmt.Sprint(raw)); text != "" {
					return text
				}
			}
		}
	case map[string]string:
		for _, key := range keys {
			if text := strings.TrimSpace(typed[key]); text != "" {
				return text
			}
		}
	}
	return ""
}

func isClowderVirtualDirectChannelID(uid string) bool {
	trimmed := strings.TrimSpace(uid)
	return trimmed == clowderAIDirectChannelID ||
		strings.HasPrefix(trimmed, "clowder_cat:") ||
		strings.HasPrefix(trimmed, "clowder:")
}

func buildOutboundMessageBody(payload OutboundPayload, content string, format string) map[string]interface{} {
	body := map[string]interface{}{
		"type":         common.Text,
		"content":      content,
		"text":         content,
		"format":       format,
		"markdown":     format == "markdown",
		"ai":           true,
		"connector_id": ConnectorID,
	}
	if payload.Media == nil {
		return body
	}

	mediaType := strings.ToLower(strings.TrimSpace(payload.Media.Type))
	mediaURL := strings.TrimSpace(payload.Media.URL)
	if mediaType == "image" && mediaURL != "" {
		body["type"] = common.Image
		body["url"] = mediaURL
		if payload.Media.FileName != "" {
			body["name"] = payload.Media.FileName
		}
		if payload.Media.Size > 0 {
			body["size"] = payload.Media.Size
		}
		if content == "" && payload.Media.Alt != "" {
			body["content"] = payload.Media.Alt
			body["text"] = payload.Media.Alt
		}
	}
	if mediaType == "file" && mediaURL != "" {
		body["type"] = common.File
		body["url"] = mediaURL
		if payload.Media.FileName != "" {
			body["name"] = payload.Media.FileName
		}
		if payload.Media.Size > 0 {
			body["size"] = payload.Media.Size
		}
		if content == "" && payload.Media.Alt != "" {
			body["content"] = payload.Media.Alt
			body["text"] = payload.Media.Alt
		}
	}
	return body
}

var ErrOutboundNoop = errors.New("clowder outbound no-op")

func parseExternalChatID(externalChatID string) (uint8, string, error) {
	parts := strings.SplitN(strings.TrimSpace(externalChatID), ":", 2)
	if len(parts) != 2 || strings.TrimSpace(parts[1]) == "" {
		return 0, "", fmt.Errorf("invalid externalChatId: %s", externalChatID)
	}
	channelType, err := strconv.ParseUint(parts[0], 10, 8)
	if err != nil || channelType == 0 {
		return 0, "", fmt.Errorf("invalid externalChatId channel type: %s", externalChatID)
	}
	return uint8(channelType), strings.TrimSpace(parts[1]), nil
}
