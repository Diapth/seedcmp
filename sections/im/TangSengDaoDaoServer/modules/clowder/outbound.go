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
	Origin            map[string]interface{}   `json:"origin,omitempty"`
	Stream            *OutboundStreamState     `json:"stream,omitempty"`
	Metadata          map[string]interface{}   `json:"metadata,omitempty"`
	PlatformMessageID string                   `json:"platformMessageId,omitempty"`
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
	if channelType == common.ChannelTypePerson.Uint8() {
		if recipientUID := directRecipientUID(payload, defaultRecipientUID); recipientUID != "" {
			channelID = recipientUID
		}
	}
	content := strings.TrimSpace(payload.Content)
	if content == "" && payload.Stream != nil && payload.Stream.State == "cleanup" {
		return nil, ErrOutboundNoop
	}
	if content == "" {
		return nil, errors.New("empty clowder outbound content")
	}

	format := strings.TrimSpace(payload.Format)
	if format == "" {
		format = "markdown"
	}
	fromUID := "clowder_ai"
	platformMessageID := payload.PlatformMessageID
	if payload.Stream != nil && payload.Stream.PlatformMessageID != "" {
		platformMessageID = payload.Stream.PlatformMessageID
	}
	body := map[string]interface{}{
		"type":         common.Text,
		"content":      content,
		"text":         content,
		"format":       format,
		"markdown":     format == "markdown",
		"ai":           true,
		"connector_id": ConnectorID,
	}
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

func directRecipientUID(payload OutboundPayload, defaultRecipientUID string) string {
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
