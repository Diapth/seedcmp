package user

import "strings"

const ClowderAIUID = "clowder_ai"

func isVirtualUser(uid string) bool {
	return uid == ClowderAIUID || strings.HasPrefix(uid, "clowder:")
}

func newVirtualUserDetailResp(uid string) *UserDetailResp {
	if !isVirtualUser(uid) {
		return nil
	}
	name := "Clowder AI"
	if strings.HasPrefix(uid, "clowder:") {
		name = "Clowder " + displayNameFromClowderUID(uid)
	}
	return &UserDetailResp{
		UID:            uid,
		Name:           name,
		Username:       uid,
		Category:       string(CategorySystem),
		Status:         StatusEnable.Int(),
		Robot:          1,
		Follow:         1,
		Online:         1,
		IsUploadAvatar: 0,
	}
}

func displayNameFromClowderUID(uid string) string {
	name := strings.TrimPrefix(uid, "clowder:")
	name = strings.TrimSpace(name)
	if name == "" {
		return "AI"
	}
	return strings.ToUpper(name[:1]) + name[1:]
}

func splitVirtualUserDetails(uids []string) ([]*UserDetailResp, []string) {
	virtualUsers := make([]*UserDetailResp, 0)
	regularUIDs := make([]string, 0, len(uids))
	seenVirtual := map[string]struct{}{}
	for _, uid := range uids {
		if isVirtualUser(uid) {
			if _, ok := seenVirtual[uid]; ok {
				continue
			}
			if detail := newVirtualUserDetailResp(uid); detail != nil {
				virtualUsers = append(virtualUsers, detail)
				seenVirtual[uid] = struct{}{}
			}
			continue
		}
		regularUIDs = append(regularUIDs, uid)
	}
	return virtualUsers, regularUIDs
}
