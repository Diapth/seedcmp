package clowder

import (
	"encoding/json"
	"fmt"
)

const ConnectorID = "im-web"

type RawIMMessage struct {
	ChannelID   string
	ChannelType uint8
	FromUID     string
	FromName    string
	MessageID   string
	ClientMsgNo string
	MessageSeq  uint32
	Timestamp   int64
	Payload     []byte
	ChatName    string
	Role        *GroupRoleSnapshot
}

type Sender struct {
	ID   string `json:"id"`
	Name string `json:"name,omitempty"`
}

type Attachment struct {
	Type     string `json:"type"`
	URL      string `json:"url,omitempty"`
	FileName string `json:"fileName,omitempty"`
	Size     int64  `json:"size,omitempty"`
}

type InboundMessage struct {
	ConnectorID    string       `json:"connectorId"`
	ExternalChatID string       `json:"externalChatId"`
	ChannelID      string       `json:"channelId"`
	ChannelType    uint8        `json:"channelType"`
	ChatType       string       `json:"chatType"`
	ChatName       string       `json:"chatName,omitempty"`
	MessageID      string       `json:"messageId"`
	ClientMsgNo    string       `json:"clientMsgNo"`
	MessageSeq     uint32       `json:"messageSeq"`
	Text           string       `json:"text"`
	Timestamp      int64        `json:"timestamp"`
	Sender         Sender       `json:"sender"`
	Attachments    []Attachment `json:"attachments,omitempty"`
	Mentions       []string     `json:"mentions,omitempty"`
	Role           *GroupRoleSnapshot `json:"sourceRoleSnapshot,omitempty"`
}

func NormalizeInboundMessage(raw RawIMMessage) (InboundMessage, error) {
	content := map[string]interface{}{}
	text := string(raw.Payload)
	if err := json.Unmarshal(raw.Payload, &content); err == nil {
		text = firstString(content, "content", "text")
		if text == "" {
			text = firstString(content, "url", "name")
		}
	}

	msg := InboundMessage{
		ConnectorID:    ConnectorID,
		ExternalChatID: fmt.Sprintf("%d:%s", raw.ChannelType, raw.ChannelID),
		ChannelID:      raw.ChannelID,
		ChannelType:    raw.ChannelType,
		ChatType:       chatType(raw.ChannelType),
		ChatName:       raw.ChatName,
		MessageID:      raw.MessageID,
		ClientMsgNo:    raw.ClientMsgNo,
		MessageSeq:     raw.MessageSeq,
		Text:           text,
		Timestamp:      raw.Timestamp,
		Sender: Sender{
			ID:   raw.FromUID,
			Name: raw.FromName,
		},
		Mentions:    extractMentions(content),
		Attachments: extractAttachments(content),
		Role:        raw.Role,
	}
	return msg, nil
}

func chatType(channelType uint8) string {
	if channelType == 2 {
		return "group"
	}
	return "direct"
}

func firstString(content map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if value, ok := content[key].(string); ok {
			return value
		}
	}
	return ""
}

func extractMentions(content map[string]interface{}) []string {
	mention, ok := content["mention"].(map[string]interface{})
	if !ok {
		return nil
	}
	rawUIDs, ok := mention["uids"].([]interface{})
	if !ok {
		return nil
	}
	uids := make([]string, 0, len(rawUIDs))
	for _, raw := range rawUIDs {
		if uid, ok := raw.(string); ok && uid != "" {
			uids = append(uids, uid)
		}
	}
	return uids
}

func extractAttachments(content map[string]interface{}) []Attachment {
	contentType, _ := content["type"].(float64)
	if contentType == 0 || contentType == 1 {
		return nil
	}
	attachmentType := "file"
	if contentType == 2 {
		attachmentType = "image"
	} else if contentType == 4 {
		attachmentType = "audio"
	}
	size, _ := content["size"].(float64)
	return []Attachment{{
		Type:     attachmentType,
		URL:      firstString(content, "url", "remote_url"),
		FileName: firstString(content, "name", "fileName", "file_name"),
		Size:     int64(size),
	}}
}
