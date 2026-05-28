package clowder

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNormalizeGroupRoleSnapshot(t *testing.T) {
	cases := []struct {
		name      string
		role      int
		isMember  bool
		wantRole  GroupRole
		wantAdmin bool
	}{
		{name: "owner", role: 1, isMember: true, wantRole: GroupRoleOwner, wantAdmin: true},
		{name: "manager", role: 2, isMember: true, wantRole: GroupRoleManager, wantAdmin: true},
		{name: "member", role: 0, isMember: true, wantRole: GroupRoleMember, wantAdmin: false},
		{name: "departed", role: 0, isMember: false, wantRole: GroupRoleDeparted, wantAdmin: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			snapshot := NormalizeGroupRoleSnapshot("group-1", "u-1", tc.role, tc.isMember)

			assert.Equal(t, "group-1", snapshot.GroupNo)
			assert.Equal(t, "u-1", snapshot.UID)
			assert.Equal(t, tc.wantRole, snapshot.Role)
			assert.Equal(t, tc.wantAdmin, snapshot.Admin)
		})
	}
}
