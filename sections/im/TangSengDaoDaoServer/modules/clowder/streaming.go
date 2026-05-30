package clowder

func StableStreamClientMsgNo(invocationID string, platformMessageID string) string {
	if platformMessageID != "" {
		return platformMessageID
	}
	if invocationID != "" {
		return "clowder-stream-" + invocationID
	}
	return "clowder-stream-unknown"
}
