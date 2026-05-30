package user

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestVirtualClowderAIUserDetail(t *testing.T) {
	detail := newVirtualUserDetailResp("clowder_ai")

	assert.Equal(t, "clowder_ai", detail.UID)
	assert.Equal(t, "Clowder AI", detail.Name)
	assert.Equal(t, "clowder_ai", detail.Username)
	assert.Equal(t, string(CategorySystem), detail.Category)
	assert.Equal(t, StatusEnable.Int(), detail.Status)
	assert.Equal(t, 1, detail.Robot)
	assert.Equal(t, 1, detail.Follow)
	assert.Equal(t, 1, detail.Online)
}

func TestVirtualLegacyClowderSenderUserDetail(t *testing.T) {
	detail := newVirtualUserDetailResp("clowder:bot")

	assert.Equal(t, "clowder:bot", detail.UID)
	assert.Equal(t, "Clowder Bot", detail.Name)
	assert.Equal(t, "clowder:bot", detail.Username)
	assert.Equal(t, string(CategorySystem), detail.Category)
	assert.Equal(t, StatusEnable.Int(), detail.Status)
	assert.Equal(t, 1, detail.Robot)
}
