package clowder

func NormalizeMediaAttachment(contentType int, url string, fileName string, size int64) Attachment {
	attachmentType := "unsupported"
	switch contentType {
	case 2:
		attachmentType = "image"
	case 4:
		attachmentType = "audio"
	case 8:
		attachmentType = "file"
	}
	return Attachment{
		Type:     attachmentType,
		URL:      url,
		FileName: fileName,
		Size:     size,
	}
}
