package robot

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/TangSengDaoDao/TangSengDaoDaoServer/modules/base/app"
	"github.com/TangSengDaoDao/TangSengDaoDaoServer/modules/user"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/common"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/config"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/log"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/util"
	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/wkhttp"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis"
	"github.com/gookit/goutil/maputil"
	"go.uber.org/zap"
)

const deepSeekAIRobotID = "deepseek_ai_robot"

type Robot struct {
	ctx *config.Context
	log.Log
	db                                robotDB
	robotEventPrefix                  string
	userService                       user.IService
	appService                        app.IService
	inlineQueryEventsMap              map[string][]*robotEvent // inlineQuery事件
	inlineQueryEventsMapLock          sync.RWMutex
	inlineQueryEventResultChanMap     map[string]chan *InlineQueryResult
	inlineQueryEventResultChanMapLock sync.RWMutex
	mentionRegexp                     *regexp.Regexp
}

func New(ctx *config.Context) *Robot {
	rb := &Robot{
		ctx:                           ctx,
		Log:                           log.NewTLog("Robot"),
		db:                            *newBotDB(ctx),
		robotEventPrefix:              "robotEvent:",
		userService:                   user.NewService(ctx),
		appService:                    app.NewService(ctx),
		inlineQueryEventsMap:          map[string][]*robotEvent{},
		inlineQueryEventResultChanMap: map[string]chan *InlineQueryResult{},
		mentionRegexp:                 regexp.MustCompile(`@\S+`),
	}
	ctx.AddMessagesListener(rb.messagesListen)

	ctx.AddMessagesListener(rb.robotMessageListen)

	return rb
}

// Route 路由配置
func (rb *Robot) Route(r *wkhttp.WKHttp) {

	auth := r.Group("/v1", rb.ctx.AuthMiddleware(r))
	{
		auth.POST("/robot/sync", rb.sync)                // 同步机器人菜单
		auth.POST("/robot/inline_query", rb.inlineQuery) // 机器人行内搜索
		auth.POST("/robot/ai_reply", rb.aiReply)         // AI机器人回复
	}

	robotAuth := r.Group("/v1/robots/:robot_id/:app_key", rb.authRobot()) // :robot_id即user的username
	{
		robotAuth.GET("/events", rb.getEventsForGet)               // 获取事件
		robotAuth.POST("/events", rb.getEventsForPost)             // 获取事件（POST方式）
		robotAuth.POST("/events/:event_id/ack", rb.eventAck)       // 事件确认
		robotAuth.POST("/answerInlineQuery", rb.answerInlineQuery) // 响应inlineQuery
		robotAuth.POST("/sendMessage", rb.sendMessage)             // 发送消息
		robotAuth.POST("/typing", rb.typing)                       // 输入中
		robotAuth.POST("/stream/start", rb.streamStart)            // 流式消息开启
		robotAuth.POST("/stream/end", rb.streamEnd)                // 流式消息结束

	}

	rb.insertSystemRobot()
}

func (rb *Robot) aiReply(c *wkhttp.Context) {
	var req struct {
		ChannelID    string `json:"channel_id"`
		ChannelType  uint8  `json:"channel_type"`
		Prompt       string `json:"prompt"`
		SystemPrompt string `json:"system_prompt"`
		Model        string `json:"model"`
		Stream       bool   `json:"stream"`
		History      []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"history"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.ResponseError(errors.New("数据格式有误！"))
		return
	}
	req.Prompt = strings.TrimSpace(req.Prompt)
	if req.Prompt == "" {
		c.ResponseError(errors.New("prompt不能为空！"))
		return
	}

	apiKey := strings.TrimSpace(os.Getenv("DEEPSEEK_API_KEY"))
	if apiKey == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"msg": "DEEPSEEK_API_KEY未配置",
		})
		return
	}

	model := strings.TrimSpace(req.Model)
	if model == "" {
		model = "deepseek-chat"
	}
	systemPrompt := strings.TrimSpace(req.SystemPrompt)
	if systemPrompt == "" {
		systemPrompt = "你是 IM 聊天中的 AI 助手。请用简洁、清晰的 Markdown 回复。"
	}

	messages := make([]map[string]string, 0, len(req.History)+2)
	messages = append(messages, map[string]string{
		"role":    "system",
		"content": systemPrompt,
	})
	for _, item := range req.History {
		role := strings.TrimSpace(item.Role)
		if role != "user" && role != "assistant" && role != "system" {
			continue
		}
		content := strings.TrimSpace(item.Content)
		if content == "" {
			continue
		}
		messages = append(messages, map[string]string{
			"role":    role,
			"content": content,
		})
	}
	messages = append(messages, map[string]string{
		"role":    "user",
		"content": req.Prompt,
	})

	body, _ := json.Marshal(map[string]interface{}{
		"model":       model,
		"messages":    messages,
		"temperature": 0.4,
		"stream":      req.Stream,
	})
	httpReq, err := http.NewRequest(http.MethodPost, "https://api.deepseek.com/chat/completions", bytes.NewReader(body))
	if err != nil {
		c.ResponseError(err)
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))

	client := &http.Client{Timeout: 45 * time.Second}
	httpResp, err := client.Do(httpReq)
	if err != nil {
		rb.Error("DeepSeek请求失败", zap.Error(err))
		c.ResponseError(errors.New("AI助手暂不可用"))
		return
	}
	defer httpResp.Body.Close()
	if httpResp.StatusCode < 200 || httpResp.StatusCode >= 300 {
		respBytes, _ := io.ReadAll(httpResp.Body)
		rb.Warn("DeepSeek返回错误", zap.Int("status", httpResp.StatusCode))
		if req.Stream {
			writeSSE(c.Writer, gin.H{"error": "AI助手暂不可用"})
			writeSSE(c.Writer, gin.H{"done": true})
		} else {
			c.JSON(httpResp.StatusCode, gin.H{
				"msg": "AI助手暂不可用",
			})
		}
		_ = respBytes
		return
	}
	if req.Stream {
		rb.streamDeepSeekReply(c, httpResp.Body, req.ChannelID, req.ChannelType, model)
		return
	}

	respBytes, _ := io.ReadAll(httpResp.Body)
	var resp struct {
		Model   string `json:"model"`
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBytes, &resp); err != nil {
		c.ResponseError(errors.New("AI响应解析失败"))
		return
	}
	reply := ""
	if len(resp.Choices) > 0 {
		reply = resp.Choices[0].Message.Content
	}
	var messageResult interface{}
	var messageID int64
	var messageSeq uint32
	var timestamp int32
	if strings.TrimSpace(req.ChannelID) != "" && req.ChannelType != 0 {
		channelID := req.ChannelID
		if req.ChannelType == common.ChannelTypePerson.Uint8() {
			channelID = c.GetLoginUID()
		}
		result, err := rb.ctx.SendMessageWithResult(&config.MsgSendReq{
			Header: config.MsgHeader{
				RedDot: 1,
			},
			FromUID:     deepSeekAIRobotID,
			ChannelID:   channelID,
			ChannelType: req.ChannelType,
			Payload: []byte(util.ToJson(map[string]interface{}{
				"content":  reply,
				"text":     reply,
				"type":     common.Text,
				"format":   "markdown",
				"markdown": true,
				"ai":       true,
			})),
		})
		if err != nil {
			rb.Error("发送AI机器人消息失败", zap.Error(err))
			c.ResponseError(errors.New("AI回复发送失败"))
			return
		}
		messageResult = result
		if result != nil {
			messageID = result.MessageID
			messageSeq = result.MessageSeq
			timestamp = int32(time.Now().Unix())
		}
	}
	c.Response(gin.H{
		"reply":       reply,
		"model":       resp.Model,
		"persisted":   messageResult != nil,
		"message_id":  messageID,
		"message_seq": messageSeq,
		"timestamp":   timestamp,
	})
}

func writeSSE(w gin.ResponseWriter, payload gin.H) {
	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	bytes, _ := json.Marshal(payload)
	_, _ = fmt.Fprintf(w, "data: %s\n\n", bytes)
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}
}

func (rb *Robot) streamDeepSeekReply(c *wkhttp.Context, body io.Reader, channelID string, channelType uint8, model string) {
	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	var builder strings.Builder
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		chunk := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if chunk == "" || chunk == "[DONE]" {
			continue
		}
		var event struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(chunk), &event); err != nil {
			continue
		}
		if len(event.Choices) == 0 {
			continue
		}
		delta := event.Choices[0].Delta.Content
		if delta == "" {
			continue
		}
		builder.WriteString(delta)
		writeSSE(c.Writer, gin.H{"delta": delta})
	}
	if err := scanner.Err(); err != nil {
		rb.Warn("读取DeepSeek流失败", zap.Error(err))
		writeSSE(c.Writer, gin.H{"error": "AI助手暂不可用"})
		return
	}

	reply := builder.String()
	var messageID int64
	var messageSeq uint32
	var timestamp int32
	persisted := false
	if strings.TrimSpace(channelID) != "" && channelType != 0 && reply != "" {
		targetChannelID := channelID
		if channelType == common.ChannelTypePerson.Uint8() {
			targetChannelID = c.GetLoginUID()
		}
		result, err := rb.ctx.SendMessageWithResult(&config.MsgSendReq{
			Header: config.MsgHeader{
				RedDot: 1,
			},
			FromUID:     deepSeekAIRobotID,
			ChannelID:   targetChannelID,
			ChannelType: channelType,
			Payload: []byte(util.ToJson(map[string]interface{}{
				"content":   reply,
				"text":      reply,
				"type":      common.Text,
				"format":    "markdown",
				"markdown":  true,
				"ai":        true,
				"streaming": false,
			})),
		})
		if err != nil {
			rb.Error("发送AI机器人流式消息失败", zap.Error(err))
			writeSSE(c.Writer, gin.H{"error": "AI回复发送失败"})
			return
		}
		persisted = result != nil
		if result != nil {
			messageID = result.MessageID
			messageSeq = result.MessageSeq
			timestamp = int32(time.Now().Unix())
		}
	}
	writeSSE(c.Writer, gin.H{
		"done":        true,
		"model":       model,
		"persisted":   persisted,
		"message_id":  messageID,
		"message_seq": messageSeq,
		"timestamp":   timestamp,
	})
}

func (rb *Robot) streamStart(c *wkhttp.Context) {
	var req config.MessageStreamStartReq
	if err := c.BindJSON(&req); err != nil {
		rb.Error("数据格式有误！", zap.Error(err))
		c.ResponseError(errors.New("数据格式有误！"))
		return
	}

	streamNo, err := rb.ctx.IMStreamStart(req)
	if err != nil {
		rb.Error("发送stream start消息失败！", zap.Error(err))
		c.ResponseError(errors.New("发送stream start消息失败！"))
		return
	}
	c.Response(gin.H{
		"stream_no": streamNo,
	})
}

func (rb *Robot) streamEnd(c *wkhttp.Context) {
	var req config.MessageStreamEndReq
	if err := c.BindJSON(&req); err != nil {
		rb.Error("数据格式有误！", zap.Error(err))
		c.ResponseError(errors.New("数据格式有误！"))
		return
	}
	err := rb.ctx.IMStreamEnd(req)
	if err != nil {
		rb.Error("发送stream end消息失败！", zap.Error(err))
		c.ResponseError(errors.New("发送stream end消息失败！"))
		return
	}
	c.ResponseOK()
}

func (rb *Robot) authRobot() wkhttp.HandlerFunc {

	return func(c *wkhttp.Context) {
		robotID := c.Param("robot_id")
		appKey := c.Param("app_key")

		robot, err := rb.db.queryVaildRobotWithRobtID(robotID)
		if err != nil {
			rb.Error("查询robot失败！", zap.Error(err))
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"msg": "查询robot失败！",
			})
			return
		}
		if robot == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"msg": "机器人不存在！",
			})
			return
		}
		appM, err := rb.appService.GetApp(robot.AppID)
		if err != nil {
			rb.Error("查询app失败！", zap.Error(err), zap.String("appID", robot.AppID))
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"msg": "查询app失败！",
			})
			return
		}
		if appM == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"msg": "app不存在！",
			})
			return
		}
		if appM.AppKey != appKey {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"msg": "appKey不正确！",
			})
			return
		}
		c.Next()
	}
}

func (rb *Robot) typing(c *wkhttp.Context) {
	var req *TypingReq
	if err := c.BindJSON(&req); err != nil {
		rb.Error("数据格式有误！", zap.Error(err))
		c.ResponseError(errors.New("数据格式有误！"))
		return
	}
	if strings.TrimSpace(req.ChannelID) == "" {
		c.ResponseError(errors.New("channel_id不能为空！"))
		return
	}
	if req.ChannelType == 0 {
		c.ResponseError(errors.New("channel_type不能为空！"))
		return
	}
	fromUID := c.Param("robot_id")
	if fromUID == "" {
		c.ResponseError(errors.New("from_uid不能为空！"))
		return
	}
	if !rb.allowSendToChannel(req.ChannelID, req.ChannelType) {
		c.ResponseError(errors.New("不允许发送消息到此频道！"))
		return
	}
	err := rb.ctx.SendTyping(req.ChannelID, req.ChannelType, fromUID)
	if err != nil {
		rb.Error("发送typing消息失败！", zap.Error(err))
		c.ResponseError(errors.New("发送typing消息失败！"))
		return
	}
	c.ResponseOK()
}

func (rb *Robot) sendMessage(c *wkhttp.Context) {
	var messageReq *MessageReq
	if err := c.BindJSON(&messageReq); err != nil {
		rb.Error("数据格式有误！", zap.Error(err))
		c.ResponseError(errors.New("数据格式有误！"))
		return
	}
	if strings.TrimSpace(messageReq.ChannelID) == "" {
		c.ResponseError(errors.New("channel_id不能为空！"))
		return
	}
	if messageReq.ChannelType == 0 {
		c.ResponseError(errors.New("channel_type不能为空！"))
		return
	}
	if len(messageReq.Payload) == 0 {
		c.ResponseError(errors.New("payload不能为空！"))
		return
	}

	if !rb.allowSendToChannel(messageReq.ChannelID, messageReq.ChannelType) {
		c.ResponseError(errors.New("不允许发送消息到此频道！"))
		return
	}

	payloadResult := maputil.Data(messageReq.Payload)
	contentTypeValue := payloadResult.Int("type")
	if contentTypeValue == 0 {
		c.ResponseError(errors.New("payload.type不能为空！"))
		return
	}
	contentType := common.ContentType(contentTypeValue)
	if !rb.supportContentType(contentType) {
		c.ResponseError(fmt.Errorf("不支持的type[%d]", contentType))
		return
	}

	if !rb.payloadIsVail(payloadResult) {
		c.ResponseError(fmt.Errorf("无效的payload[%s]", util.ToJson(messageReq.Payload)))
		return
	}
	robotID := c.Param("robot_id")
	userResp, err := rb.userService.GetUserWithUsername(robotID)
	if err != nil {
		rb.Error("查询机器人的用户信息失败！", zap.Error(err))
		c.ResponseError(fmt.Errorf("获取机器人[%s]信息失败！", robotID))
		return
	}
	if userResp == nil {
		c.ResponseError(fmt.Errorf("机器人[%s]不存在！", robotID))
		return
	}
	result, err := rb.ctx.SendMessageWithResult(&config.MsgSendReq{
		StreamNo:    messageReq.StreamNo,
		ChannelID:   messageReq.ChannelID,
		ChannelType: messageReq.ChannelType,
		FromUID:     robotID,
		Payload:     []byte(util.ToJson(messageReq.Payload)),
	})
	if err != nil {
		rb.Error("发送robot消息失败！", zap.Error(err))
		c.ResponseError(errors.New("发送消息失败！"))
		return
	}
	c.Response(result)
}

func (rb *Robot) supportContentType(contentType common.ContentType) bool {
	return contentType == common.Text
}

func (rb *Robot) payloadIsVail(payloadResult maputil.Data) bool {
	contentType := common.ContentType(payloadResult.Int("type"))
	if contentType == common.Text {
		if payloadResult.Get("content") != nil {
			return true
		}
	}
	return false
}

// 是否允许发送消息到频道
func (rb *Robot) allowSendToChannel(channelID string, channelType uint8) bool {
	// TODO：待完善
	return true
}

func (rb *Robot) answerInlineQuery(c *wkhttp.Context) {
	var result *InlineQueryResult
	if err := c.BindJSON(&result); err != nil {
		rb.Error("数据格式有误！", zap.Error(err))
		c.ResponseError(errors.New("数据格式有误！"))
		return
	}
	if err := result.Check(); err != nil {
		c.ResponseError(err)
		return
	}
	rb.inlineQueryEventResultChanMapLock.Lock()
	resultChan := rb.inlineQueryEventResultChanMap[result.InlineQuerySID]
	rb.inlineQueryEventResultChanMapLock.Unlock()
	if resultChan != nil {
		resultChan <- result
	}
	c.ResponseOK()
}

func (rb *Robot) inlineQuery(c *wkhttp.Context) {
	var req struct {
		Offset      string `json:"offset"`
		Query       string `json:"query"`
		Username    string `json:"username"`
		ChannelID   string `json:"channel_id"`
		ChannelType uint8  `json:"channel_type"`
	}
	if err := c.BindJSON(&req); err != nil {
		rb.Error("数据格式有误！", zap.Error(err))
		c.ResponseError(errors.New("数据格式有误！"))
		return
	}
	if len(req.Username) == 0 {
		c.ResponseError(errors.New("username不能为空！"))
		return
	}
	robotM, err := rb.db.queryWithUsername(req.Username)
	if err != nil {
		c.ResponseErrorf("查询机器人失败！", err)
		return
	}
	if robotM == nil {
		c.ResponseError(errors.New("机器人不存在！"))
		return
	}
	if strings.TrimSpace(robotM.AppID) == "" {
		rb.Error("机器人没有app_id", zap.String("username", req.Username))
		c.ResponseError(errors.New("机器人没有app_id！"))
		return
	}
	robotID := robotM.RobotID
	sid := util.GenerUUID()
	inlineQuery := &InlineQuery{
		SID:         sid,
		Query:       req.Query,
		FromUID:     c.GetLoginUID(),
		ChannelID:   req.ChannelID,
		ChannelType: req.ChannelType,
		Offset:      req.Offset,
	}

	rb.addInlineQuery(robotID, inlineQuery)

	resultChan := make(chan *InlineQueryResult)

	rb.inlineQueryEventResultChanMapLock.Lock()
	rb.inlineQueryEventResultChanMap[sid] = resultChan
	rb.inlineQueryEventResultChanMapLock.Unlock()

	select {
	case result := <-resultChan:
		c.JSON(http.StatusOK, result)
	case <-time.After(time.Second * 20):
		c.AbortWithStatus(http.StatusRequestTimeout)
	}

	rb.inlineQueryEventResultChanMapLock.Lock()
	close(resultChan)
	delete(rb.inlineQueryEventResultChanMap, sid)
	rb.inlineQueryEventResultChanMapLock.Unlock()

	rb.removeInlineQuery(robotID, sid)

}

func (rb *Robot) addInlineQuery(robotID string, inlineQuery *InlineQuery) {
	seq := rb.ctx.GenSeq(fmt.Sprintf("%s%s", common.RobotEventSeqKey, robotID))
	rb.inlineQueryEventsMapLock.Lock()
	events := rb.inlineQueryEventsMap[robotID]
	if events == nil {
		events = make([]*robotEvent, 0)
	}
	events = append(events, &robotEvent{
		EventID:     seq,
		InlineQuery: inlineQuery,
		Expire:      time.Now().Add(rb.ctx.GetConfig().Robot.InlineQueryTimeout).Unix(),
	})
	rb.inlineQueryEventsMap[robotID] = events
	rb.inlineQueryEventsMapLock.Unlock()
}

func (rb *Robot) removeInlineQuery(robotID, sid string) {
	rb.inlineQueryEventsMapLock.Lock()
	defer func() {
		rb.inlineQueryEventsMapLock.Unlock()
	}()
	events := rb.inlineQueryEventsMap[robotID]
	if len(events) == 0 {
		return
	}
	removeIdx := -1
	for idx, event := range events {
		if event.InlineQuery.SID == sid {
			removeIdx = idx
			break
		}
	}
	if removeIdx != -1 {
		events = append(events[:removeIdx], events[removeIdx+1:]...)
		rb.inlineQueryEventsMap[robotID] = events
	}
}

type robotEventSortSlice []*robotEvent

func (r robotEventSortSlice) Len() int {
	return len(r)
}

func (r robotEventSortSlice) Swap(i, j int) {
	r[i], r[j] = r[j], r[i]
}

func (r robotEventSortSlice) Less(i, j int) bool {
	return r[i].EventID < r[j].EventID
}

func (rb *Robot) getEventsResult(robotID string, eventID int64, limit int64) ([]*robotEventResp, error) {

	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	robotEventJsons, err := rb.ctx.GetRedisConn().ZRangeByScore(fmt.Sprintf("%s%s", rb.robotEventPrefix, robotID), redis.ZRangeBy{
		Max:   "+inf",
		Min:   fmt.Sprintf("%d", eventID),
		Count: limit,
	})
	if err != nil {
		return nil, err
	}
	rb.inlineQueryEventResultChanMapLock.RLock()
	robotEvents := rb.inlineQueryEventsMap[robotID]
	rb.inlineQueryEventResultChanMapLock.RUnlock()
	newRobotEvents := make([]*robotEvent, 0, len(robotEvents)+int(limit))

	results := make([]*robotEventResp, 0, len(robotEvents)+int(limit))

	if len(robotEvents) > 0 {
		newRobotEvents = append(newRobotEvents, robotEvents...)
	}

	if len(robotEventJsons) > 0 {
		for _, robotEventJson := range robotEventJsons {
			var robotEvent = &robotEvent{}
			err = util.ReadJsonByByte([]byte(robotEventJson), &robotEvent)
			if err != nil {
				rb.Error("机器人消息解码失败！", zap.Error(err))
				continue
			}
			newRobotEvents = append(newRobotEvents, robotEvent)
		}
	}
	if len(newRobotEvents) > 0 {
		robotEventsSlice := robotEventSortSlice(newRobotEvents)
		sort.Sort(robotEventsSlice)
		if int64(len(robotEventsSlice)) > limit {
			robotEventsSlice = robotEventsSlice[0:limit]
		}
		for _, robotEvent := range robotEventsSlice {
			if robotEvent.EventID <= eventID {
				continue
			}
			robotEventResp := &robotEventResp{}
			robotEventResp.from(robotEvent)
			results = append(results, robotEventResp)
		}
	}
	return results, nil

}

// 移除指定事件
func (rb *Robot) removeEvent(robotID string, eventID int64) error {
	err := rb.ctx.GetRedisConn().ZRemRangeByScore(fmt.Sprintf("%s%s", rb.robotEventPrefix, robotID), fmt.Sprintf("%d", eventID), fmt.Sprintf("%d", eventID))
	return err
}

func (rb *Robot) getEventsForPost(c *wkhttp.Context) {
	robotID := c.Param("robot_id")
	var req struct {
		Limit   int64 `json:"limit"`
		EventID int64 `json:"event_id"`
	}
	if err := c.BindJSON(&req); err != nil {
		rb.Error("数据格式有误！", zap.Error(err))
		c.ResponseError(errors.New("数据格式有误！"))
		return
	}
	results, err := rb.getEventsResult(robotID, req.EventID, req.Limit)
	if err != nil {
		c.Response(gin.H{
			"status": 0,
			"msg":    err.Error(),
		})
		return
	}
	c.Response(gin.H{
		"status":  1,
		"results": results,
	})
}

func (rb *Robot) getEventsForGet(c *wkhttp.Context) {
	robotID := c.Param("robot_id")
	eventID := c.Query("event_id")
	limit, _ := strconv.ParseInt(c.Query("limit"), 10, 64)
	eventIDI64, _ := strconv.ParseInt(eventID, 10, 64)

	results, err := rb.getEventsResult(robotID, eventIDI64, limit)
	if err != nil {
		c.Response(gin.H{
			"status": 0,
			"msg":    err.Error(),
		})
		return
	}

	c.Response(gin.H{
		"status":  1,
		"results": results,
	})

}

func (rb *Robot) eventAck(c *wkhttp.Context) {
	robotID := c.Param("robot_id")
	eventID, _ := strconv.ParseInt(c.Param("event_id"), 10, 64)

	err := rb.removeEvent(robotID, eventID)
	if err != nil {
		c.ResponseError(err)
		return
	}
	c.ResponseOK()

}

func (rb *Robot) insertSystemRobot() {
	robotID := rb.ctx.GetConfig().Account.SystemUID
	if err := rb.ensureDeepSeekRobotAccount(); err != nil {
		rb.Error("初始化DeepSeek AI机器人错误", zap.Error(err))
		panic(err)
	}
	m, err := rb.db.queryRobotWithRobtID(robotID)
	if err != nil {
		rb.Error("查询系统机器人错误", zap.Error(err))
		panic(err)
	}
	if m == nil {
		tx, err := rb.db.session.Begin()
		if err != nil {
			rb.Error("开启事物错误", zap.Error(err))
			return
		}
		defer func() {
			if err := recover(); err != nil {
				tx.Rollback()
				panic(err)
			}
		}()
		err = rb.db.insertTx(&robot{
			RobotID: robotID,
			Status:  int(Enable),
			Token:   util.GenerUUID(),
			Version: rb.ctx.GenSeq(common.RobotSeqKey),
		}, tx)
		if err != nil {
			tx.Rollback()
			rb.Error("添加系统机器人错误", zap.Error(err))
			panic(err)
		}
		list := make([]*menu, 0)
		for _, m := range systemRobotMap {
			list = append(list, &menu{
				RobotID: robotID,
				CMD:     m.CMD,
				Remark:  m.Remark,
				Type:    m.Type,
			})
		}
		for _, menu := range list {
			err = rb.db.insertMenuTx(menu, tx)
			if err != nil {
				tx.Rollback()
				rb.Error("添加系统机器人菜单错误", zap.Error(err))
				panic(err)
			}
		}
		err = tx.Commit()
		if err != nil {
			tx.RollbackUnlessCommitted()
			rb.Error("添加系统机器人事物提交失败", zap.Error(err))
			panic(err)
		}
	}
}

func (rb *Robot) ensureDeepSeekRobotAccount() error {
	tx, err := rb.db.session.Begin()
	if err != nil {
		return err
	}
	defer tx.RollbackUnlessCommitted()

	_, err = tx.InsertBySql(
		"insert into `user` (uid,name,username,short_no,phone,zone,search_by_phone,search_by_short,new_msg_notice,voice_on,shock_on,msg_show_detail,status,is_upload_avatar,category,robot) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),username=VALUES(username),status=VALUES(status),category=VALUES(category),robot=VALUES(robot),updated_at=NOW()",
		deepSeekAIRobotID,
		"DeepSeek AI",
		deepSeekAIRobotID,
		"21000",
		"13000021000",
		"0086",
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		1,
		string(user.CategorySystem),
		1,
	).Exec()
	if err != nil {
		return err
	}

	_, err = tx.InsertBySql(
		"insert into robot (robot_id,username,token,version,status) values (?,?,?,?,?) ON DUPLICATE KEY UPDATE username=VALUES(username),status=VALUES(status),updated_at=NOW()",
		deepSeekAIRobotID,
		deepSeekAIRobotID,
		util.GenerUUID(),
		rb.ctx.GenSeq(common.RobotSeqKey),
		int(Enable),
	).Exec()
	if err != nil {
		return err
	}
	return tx.Commit()
}

// 同步机器人菜单
func (rb *Robot) sync(c *wkhttp.Context) {
	type req struct {
		RobotID  string `json:"robot_id"` // TODO: robotID为了兼容老版本，新版用username
		Version  int64  `json:"version"`
		Username string `json:"username"`
	}
	var reqs []*req
	if err := c.BindJSON(&reqs); err != nil {
		c.ResponseError(errors.New("请求数据格式有误！"))
		return
	}

	robotIDs := make([]string, 0)
	usernames := make([]string, 0)
	for _, reqModel := range reqs {
		if strings.TrimSpace(reqModel.RobotID) != "" {
			robotIDs = append(robotIDs, reqModel.RobotID)
		}
		if strings.TrimSpace(reqModel.Username) != "" {
			usernames = append(usernames, reqModel.Username)
		}
	}

	result := make([]*syncResp, 0)
	var robotList []*robot
	var err error
	if len(robotIDs) > 0 {
		robotList, err = rb.db.queryWithIDs(robotIDs)
		if err != nil {
			c.ResponseError(errors.New("批量查询机器人数据错误"))
			rb.Error("批量查询机器人数据错误", zap.Error(err))
			return
		}
	} else if len(usernames) > 0 {
		robotList, err = rb.db.queryWithUsernames(usernames)
		if err != nil {
			c.ResponseError(errors.New("批量通过username查询机器人数据错误"))
			rb.Error("批量通过username查询机器人数据错误", zap.Error(err))
			return
		}
	}

	respRobotIDs := make([]string, 0)
	for _, reqModel := range reqs {
		for _, robot := range robotList {
			if ((len(robotIDs) > 0 && reqModel.RobotID == robot.RobotID) || (len(usernames) > 0 && reqModel.Username == robot.Username)) && reqModel.Version < robot.Version {
				respRobotIDs = append(respRobotIDs, robot.RobotID)
				break
			}
		}
	}
	if len(respRobotIDs) == 0 {
		c.Response(result)
		return
	}
	menus, err := rb.db.queryMenusWithRobotIDs(respRobotIDs)
	if err != nil {
		c.ResponseError(errors.New("批量查询机器人菜单数据错误"))
		rb.Error("批量查询机器人菜单数据错误", zap.Error(err))
		return
	}
	for _, robotID := range respRobotIDs {
		var version int64
		var status int
		var created_at string
		var updated_at string
		var username string
		var placeholder string
		var inlineOn int
		for _, robot := range robotList {
			if robotID == robot.RobotID {
				version = robot.Version
				status = robot.Status
				created_at = robot.CreatedAt.String()
				updated_at = robot.UpdatedAt.String()
				username = robot.Username
				placeholder = robot.Placeholder
				inlineOn = robot.InlineOn
				break
			}
		}
		robotMenus := make([]*menuResp, 0)
		for _, menu := range menus {
			if menu.RobotID == robotID {
				robotMenus = append(robotMenus, &menuResp{
					RobotID:   robotID,
					CMD:       menu.CMD,
					Remark:    menu.Remark,
					Type:      menu.Type,
					CreatedAt: menu.CreatedAt.String(),
					UpdatedAt: menu.UpdatedAt.String(),
				})
			}
		}
		result = append(result, &syncResp{
			RobotID:     robotID,
			Username:    username,
			Placeholder: placeholder,
			InlineOn:    inlineOn,
			Status:      status,
			Version:     version,
			CreatedAt:   created_at,
			UpdatedAt:   updated_at,
			Menus:       robotMenus,
		})
	}
	c.Response(result)
}

type syncResp struct {
	RobotID     string      `json:"robot_id"`
	Username    string      `json:"username"`
	InlineOn    int         `json:"inline_on"`
	Placeholder string      `json:"placeholder"`
	Status      int         `json:"status"`
	Version     int64       `json:"version"`
	CreatedAt   string      `json:"created_at"`
	UpdatedAt   string      `json:"updated_at"`
	Menus       []*menuResp `json:"menus"`
}
type menuResp struct {
	CMD       string `json:"cmd"`
	Remark    string `json:"remark"`
	Type      string `json:"type"`
	RobotID   string `json:"robot_id"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type robotEventResp struct {
	EventID     int64                   `json:"event_id,omitempty"` // 更新ID
	Message     *simpleRobotMessageResp `json:"message,omitempty"`  // 消息对象
	InlineQuery *InlineQuery            `json:"inline_query"`       // 查询
}

func (s *robotEventResp) from(resp *robotEvent) {
	s.EventID = resp.EventID
	if resp.Message != nil {
		simpleRobotMessageResp := &simpleRobotMessageResp{}
		simpleRobotMessageResp.from(resp.Message)
		s.Message = simpleRobotMessageResp
	}
	if resp.InlineQuery != nil {
		s.InlineQuery = resp.InlineQuery
	}

}

type simpleRobotMessageResp struct {
	MessageID   int64       `json:"message_id"`             // 服务端的消息ID(全局唯一)
	MessageSeq  uint32      `json:"message_seq"`            // 消息序列号 （用户唯一，有序递增）
	FromUID     string      `json:"from_uid"`               // 发送者UID
	ChannelID   string      `json:"channel_id,omitempty"`   // 频道ID
	ChannelType uint8       `json:"channel_type,omitempty"` // 频道类型
	Timestamp   int32       `json:"timestamp"`              // 服务器消息时间戳(10位，到秒)
	Payload     interface{} `json:"payload"`                // 消息正文
}

func (s *simpleRobotMessageResp) from(messageResp *config.MessageResp) {
	s.MessageID = messageResp.MessageID
	s.MessageSeq = messageResp.MessageSeq
	s.FromUID = messageResp.FromUID
	if messageResp.ChannelType != common.ChannelTypePerson.Uint8() {
		s.ChannelID = messageResp.ChannelID
		s.ChannelType = messageResp.ChannelType
	}
	s.Timestamp = messageResp.Timestamp
	var payloadMap map[string]interface{}
	if err := util.ReadJsonByByte(messageResp.Payload, &payloadMap); err != nil {
		fmt.Println("解码消息正文失败！", err)
	}
	s.Payload = payloadMap
}
