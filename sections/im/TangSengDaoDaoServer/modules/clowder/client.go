package clowder

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	commonmodule "github.com/TangSengDaoDao/TangSengDaoDaoServer/modules/common"
)

type Client struct {
	BaseURL    string
	Secret     string
	HTTPClient *http.Client
	Now        func() time.Time
}

type RouteResponse struct {
	Kind      string `json:"kind"`
	ThreadID  string `json:"threadId,omitempty"`
	MessageID string `json:"messageId,omitempty"`
	Reason    string `json:"reason,omitempty"`
}

func NewClient(baseURL string, secret string, timeout time.Duration) *Client {
	if timeout == 0 {
		timeout = 5 * time.Second
	}
	return &Client{
		BaseURL: strings.TrimRight(baseURL, "/"),
		Secret:  secret,
		HTTPClient: &http.Client{
			Timeout: timeout,
		},
		Now: time.Now,
	}
}

func (c *Client) ForwardInbound(message InboundMessage) (RouteResponse, error) {
	body, err := json.Marshal(message)
	if err != nil {
		return RouteResponse{}, err
	}
	timestamp := fmt.Sprintf("%d", c.Now().UnixMilli())
	signature := commonmodule.SignClowderPayload(body, c.Secret, timestamp)

	req, err := http.NewRequest(http.MethodPost, c.BaseURL+"/api/connectors/im-web/inbound", bytes.NewReader(body))
	if err != nil {
		return RouteResponse{}, err
	}
	req.Header.Set("content-type", "application/json")
	req.Header.Set("x-im-web-timestamp", timestamp)
	req.Header.Set("x-im-web-signature", signature)

	res, err := c.HTTPClient.Do(req)
	if err != nil {
		return RouteResponse{}, err
	}
	defer res.Body.Close()

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return RouteResponse{}, fmt.Errorf("clowder inbound failed: %s", res.Status)
	}

	var routed RouteResponse
	if err := json.NewDecoder(res.Body).Decode(&routed); err != nil {
		return RouteResponse{}, err
	}
	return routed, nil
}
