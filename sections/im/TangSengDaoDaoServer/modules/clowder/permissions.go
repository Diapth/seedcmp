package clowder

type GroupRole string

const (
	GroupRoleOwner    GroupRole = "owner"
	GroupRoleManager  GroupRole = "manager"
	GroupRoleMember   GroupRole = "member"
	GroupRoleDeparted GroupRole = "departed"
)

type GroupRoleSnapshot struct {
	GroupNo string    `json:"group_no"`
	UID     string    `json:"uid"`
	Role    GroupRole `json:"role"`
	Admin   bool      `json:"admin"`
}

func NormalizeGroupRoleSnapshot(groupNo string, uid string, role int, isMember bool) GroupRoleSnapshot {
	if !isMember {
		return GroupRoleSnapshot{GroupNo: groupNo, UID: uid, Role: GroupRoleDeparted, Admin: false}
	}
	switch role {
	case 1:
		return GroupRoleSnapshot{GroupNo: groupNo, UID: uid, Role: GroupRoleOwner, Admin: true}
	case 2:
		return GroupRoleSnapshot{GroupNo: groupNo, UID: uid, Role: GroupRoleManager, Admin: true}
	default:
		return GroupRoleSnapshot{GroupNo: groupNo, UID: uid, Role: GroupRoleMember, Admin: false}
	}
}
