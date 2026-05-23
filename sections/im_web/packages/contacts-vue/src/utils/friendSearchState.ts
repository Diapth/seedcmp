export type FriendSearchStateType = 'self' | 'friend' | 'can_apply';

export interface FriendSearchState {
  type: FriendSearchStateType;
  message: string;
}

interface FriendLike {
  uid?: string;
  follow?: number;
}

interface FriendSearchContext {
  currentUid?: string;
  contacts?: FriendLike[];
}

function sameUid(left: unknown, right: unknown) {
  return String(left || '').trim() !== '' && String(left || '') === String(right || '');
}

export function getFriendSearchState(user: FriendLike | null | undefined, context: FriendSearchContext): FriendSearchState {
  const uid = String(user?.uid || '');
  if (sameUid(uid, context.currentUid)) {
    return {
      type: 'self',
      message: '这是你自己'
    };
  }

  const isFriend = Number(user?.follow || 0) === 1 || (context.contacts || []).some(contact => sameUid(contact.uid, uid));
  if (isFriend) {
    return {
      type: 'friend',
      message: '该用户已是你的好友'
    };
  }

  return {
    type: 'can_apply',
    message: ''
  };
}
