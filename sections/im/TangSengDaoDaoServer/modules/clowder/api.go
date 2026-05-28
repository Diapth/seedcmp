package clowder

import (
	"io"
	"net/http"
	"time"

	commonmodule "github.com/TangSengDaoDao/TangSengDaoDaoServer/modules/common"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/log"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/wkhttp"
)

type Clowder struct {
	ctx *config.Context
	log.Log
	config commonmodule.ClowderBridgeConfig
}

func New(ctx *config.Context) *Clowder {
	return &Clowder{
		ctx:    ctx,
		Log:    log.NewTLog("clowder"),
		config: commonmodule.DefaultClowderBridgeConfig(),
	}
}

func (c *Clowder) Route(r *wkhttp.WKHttp) {
	auth := r.Group("/v1/clowder", c.ctx.AuthMiddleware(r))
	{
		auth.GET("/status", c.status)
	}

	r.POST("/api/im-web/clowder/outbound", c.outbound)
}

func (c *Clowder) status(ctx *wkhttp.Context) {
	ctx.JSON(http.StatusOK, map[string]interface{}{
		"enabled":     c.config.Enabled,
		"configured":  c.config.IsConfigured(),
		"connectorId": c.config.ConnectorID,
		"state":       c.state(),
	})
}

func (c *Clowder) outbound(ctx *wkhttp.Context) {
	rawBody, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_body"})
		return
	}
	err = commonmodule.VerifyClowderSignature(
		rawBody,
		c.config.ConnectorSecret,
		ctx.GetHeader("x-clowder-timestamp"),
		ctx.GetHeader("x-clowder-signature"),
		time.Now(),
		c.config.SignatureTolerance,
	)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid_signature"})
		return
	}

	ctx.JSON(http.StatusOK, map[string]interface{}{
		"ok": true,
	})
}

func (c *Clowder) state() string {
	if !c.config.Enabled {
		return "disabled"
	}
	if !c.config.IsConfigured() {
		return "unconfigured"
	}
	return "ready"
}
