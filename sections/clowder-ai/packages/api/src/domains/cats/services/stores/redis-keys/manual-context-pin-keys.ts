export const ManualContextPinKeys = {
  detail: (id: string) => `manual-context-pin:${id}`,
  threadUser: (threadId: string, userId: string) => `manual-context-pins:thread:${threadId}:user:${userId}`,
  subject: (threadId: string, userId: string, messageId: string) => `manual-context-pin-subject:${threadId}:${userId}:${messageId}`,
} as const;
