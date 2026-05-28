package robot

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"testing"

	"github.com/TangSengDaoDao/TangSengDaoDaoServer/modules/base/event"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/util"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/wkhttp"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/server"
	"github.com/stretchr/testify/assert"
)

var uid = "10000"
var token = "token122323"

func newTestServer() (*server.Server, *config.Context) {
	os.Remove("test.db")
	cfg := config.New()
	cfg.Test = true
	cfg.DB.MySQLAddr = "tsdd_user:tsdd_password@tcp(127.0.0.1:3306)/im?charset=utf8mb4&parseTime=true&loc=Local"
	ctx := config.NewContext(cfg)
	ctx.Event = event.New(ctx)
	err := ctx.Cache().Set(cfg.Cache.TokenCachePrefix+token, wkhttp.EncodeTokenCacheInfo(uid, "test", ""))
	if err != nil {
		panic(err)
	}
	// 创建server
	s := server.New(ctx)
	return s, ctx

}
func TestSyncRobot(t *testing.T) {
	s, ctx := newTestServer()
	f := New(ctx)
	f.Route(s.GetRoute())

	w := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/v1/robot/sync", bytes.NewReader([]byte(util.ToJson([]map[string]interface{}{
		{
			"robot_id": ctx.GetConfig().Account.SystemUID,
			"version":  0,
		},
	}))))
	assert.NoError(t, err)
	req.Header.Set("token", token)
	s.GetRoute().ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestMention(t *testing.T) {

	reg := regexp.MustCompile(`@\S+`)

	fmt.Println(reg.FindAllString("dsds @增加啊每个萨摩 你好", -1))
}

func TestSystemRobotCommandParsingUsesConfiguredSystemUID(t *testing.T) {
	cfg := config.New()
	cfg.Test = true
	cfg.Account.SystemUID = "custom_system_robot"
	ctx := config.NewContext(cfg)
	rb := New(ctx)

	payload := util.ToJson(map[string]interface{}{
		"content":  "/基本信息",
		"robot_id": cfg.Account.SystemUID,
		"type":     1,
		"entities": []map[string]interface{}{
			{
				"type":   "bot_command",
				"offset": json.Number("0"),
				"length": json.Number("5"),
			},
		},
	})
	contentMap, err := util.JsonToMap(payload)

	assert.NoError(t, err)
	assert.Equal(t, rb.ctx.GetConfig().Account.SystemUID, contentMap["robot_id"])
	entities := contentMap["entities"].([]interface{})
	entity := entities[0].(map[string]interface{})
	offset := jsonNumberToInt64(entity["offset"])
	length := jsonNumberToInt64(entity["length"])
	contentRuns := []rune(contentMap["content"].(string))
	assert.Equal(t, "/基本信息", string(contentRuns[offset:offset+length]))
}

func TestInsertSystemRobotCreatesIndependentDeepSeekRobotAccount(t *testing.T) {
	_, ctx := newTestServer()
	rb := New(ctx)

	rb.insertSystemRobot()

	var userCount int
	err := rb.db.session.Select("count(*)").From("user").
		Where("uid=? and username=? and robot=1 and status=1", "deepseek_ai_robot", "deepseek_ai_robot").
		LoadOne(&userCount)
	assert.NoError(t, err)
	assert.Equal(t, 1, userCount)

	var robotCount int
	err = rb.db.session.Select("count(*)").From("robot").
		Where("robot_id=? and username=? and status=1", "deepseek_ai_robot", "deepseek_ai_robot").
		LoadOne(&robotCount)
	assert.NoError(t, err)
	assert.Equal(t, 1, robotCount)
}
