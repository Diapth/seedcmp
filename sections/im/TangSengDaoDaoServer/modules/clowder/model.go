package clowder

import "time"

type BindingStatus string

const (
	BindingStatusActive   BindingStatus = "active"
	BindingStatusDisabled BindingStatus = "disabled"
	BindingStatusOrphaned BindingStatus = "orphaned"
	BindingStatusFailed   BindingStatus = "failed"
)

type IMConnectorBinding struct {
	ConnectorID    string        `json:"connectorId"`
	ExternalChatID string        `json:"externalChatId"`
	ChannelID      string        `json:"channelId"`
	ChannelType    uint8         `json:"channelType"`
	ThreadID       string        `json:"threadId"`
	UserID         string        `json:"userId"`
	HubThreadID    string        `json:"hubThreadId,omitempty"`
	Status         BindingStatus `json:"status"`
	CreatedAt      time.Time     `json:"createdAt"`
	UpdatedAt      time.Time     `json:"updatedAt"`
}

type BindingStore interface {
	Bind(binding IMConnectorBinding) (IMConnectorBinding, error)
	Get(connectorID string, externalChatID string) (IMConnectorBinding, bool, error)
}

type MemoryBindingStore struct {
	bindings map[string]IMConnectorBinding
}

func NewMemoryBindingStore() *MemoryBindingStore {
	return &MemoryBindingStore{bindings: map[string]IMConnectorBinding{}}
}

func (s *MemoryBindingStore) Bind(binding IMConnectorBinding) (IMConnectorBinding, error) {
	if binding.ConnectorID == "" {
		binding.ConnectorID = ConnectorID
	}
	if binding.Status == "" {
		binding.Status = BindingStatusActive
	}
	now := time.Now()
	if binding.CreatedAt.IsZero() {
		binding.CreatedAt = now
	}
	binding.UpdatedAt = now
	s.bindings[bindingKey(binding.ConnectorID, binding.ExternalChatID)] = binding
	return binding, nil
}

func (s *MemoryBindingStore) Get(connectorID string, externalChatID string) (IMConnectorBinding, bool, error) {
	binding, ok := s.bindings[bindingKey(connectorID, externalChatID)]
	return binding, ok, nil
}

func bindingKey(connectorID string, externalChatID string) string {
	return connectorID + ":" + externalChatID
}
