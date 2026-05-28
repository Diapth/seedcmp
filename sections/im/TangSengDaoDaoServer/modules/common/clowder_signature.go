package common

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"time"
)

func SignClowderPayload(body []byte, secret string, timestamp string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp))
	mac.Write([]byte("."))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

func VerifyClowderSignature(body []byte, secret string, timestamp string, signature string, now time.Time, tolerance time.Duration) error {
	if secret == "" {
		return errors.New("missing clowder signature secret")
	}
	if timestamp == "" || signature == "" {
		return errors.New("missing clowder signature headers")
	}

	millis, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid clowder signature timestamp: %w", err)
	}

	signedAt := time.UnixMilli(millis)
	if now.Sub(signedAt) > tolerance || signedAt.Sub(now) > tolerance {
		return errors.New("stale clowder signature timestamp")
	}

	expected := SignClowderPayload(body, secret, timestamp)
	if !hmac.Equal([]byte(expected), []byte(signature)) {
		return errors.New("invalid clowder signature")
	}

	return nil
}
