# V2 test execution 20260607-115248

Base URL: http://172.18.58.156:5173
Screenshots: sections/agenthub_ui/.ai/tests/screenshots/v2-20260607-115248
Issue screenshots: sections/agenthub_ui/.ai/issue/screenshots/v2-20260607-115248

| Case | Status | Actual |
|---|---|---|
| V2-01-01 H5 启动可达 | PASS | URL=http://172.18.58.156:5173/#/; 登录页可见=true; body=AgentHub 通讯<br>连接团队与多智能体的协作门户<br>账号登录<br>二维码登录<br>手机号 / 用户名<br>手机号 / 用户名<br>密码<br>请输入密码<br>自动登录<br>忘记密码？<br>安全登录<br>还没有账号？<br>注册账号 |
| V2-01-02 账号 A 登录 | PASS | 进入主页=true; 登录 API 调用数=2; tokenKeys=true; mockToken=false; storage={"im.wsAddr":"ws://0.0.0.0:5200","auth.uid":"41232e72652648f8946988f45ba4895d","auth.accessToken":"a48***8d5","__DC_STAT_UUID":"17808043711953181977","app_user":"{\"uid\":\"412***95d\",\"app_id\":\"\",\"name\":\"leng\",\"use***ame\":\"008***709\",\"sex\":1,\"cat***ory\":\"\",\"sho***_no\":\"yww***Vjs\",\"zone\":\"0086\",\"phone\":\"137***709\",\"token\":\"a48***8d5\",\"cha***pwd\":\"\",\"loc***pwd\":\"\",\"loc***ute\":0,\"setting\":{\"sea***one\":1,\"sea***ort\":1,\"new***ice\":1,\"msg***ail\":1,\"voi***_on\":1,\"sho***_on\":1,\"off***ion\":0,\"dev***ock\":0,\"mut***app\":0},\"rsa***key\":\"LS0***tCg==\",\"sho***tus\":0,\"msg***ond\":0,\"avatar\":\"\",\"ref***ken\":\"\",\"exp***sAt\":0,\"id\":\"412***95d\",\"nic***ame\":\"leng\"}","app_token":"a48***8d5","im.token":"a48***8d5","auth.loginInfo":"{\"uid\":\"412***95d\",\"app_id\":\"\",\"name\":\"leng\",\"use***ame\":\"008***709\",\"sex\":1,\"cat***ory\":\"\",\"sho***_no\":\"yww***Vjs\",\"zone\":\"0086\",\"phone\":\"137***709\",\"token\":\"a48***8d5\",\"cha***pwd\":\"\",\"loc***pwd\":\"\",\"loc***ute\":0,\"setting\":{\"sea***one\":1,\"sea***ort\":1,\"new***ice\":1,\"msg***ail\":1,\"voi***_on\":1,\"sho***_on\":1,\"off***ion\":0,\"dev***ock\":0,\"mut***app\":0},\"rsa***key\":\"LS0***tCg==\",\"sho***tus\":0,\"msg***ond\":0,\"avatar\":\"\",\"ref***ken\":\"\",\"exp***sAt\":0}"} |
| V2-01-03 token 持久化 | PASS | 刷新后 URL=http://172.18.58.156:5173/#/pages/chat/index; 仍登录=true; storage={"im.wsAddr":"ws://0.0.0.0:5200","auth.uid":"41232e72652648f8946988f45ba4895d","auth.accessToken":"a48***8d5","__DC_STAT_UUID":"17808043711953181977","app_user":"{\"uid\":\"412***95d\",\"app_id\":\"\",\"name\":\"leng\",\"use***ame\":\"008***709\",\"sex\":1,\"cat***ory\":\"\",\"sho***_no\":\"yww***Vjs\",\"zone\":\"0086\",\"phone\":\"137***709\",\"token\":\"a48***8d5\",\"cha***pwd\":\"\",\"loc***pwd\":\"\",\"loc***ute\":0,\"setting\":{\"sea***one\":1,\"sea***ort\":1,\"new***ice\":1,\"msg***ail\":1,\"voi***_on\":1,\"sho***_on\":1,\"off***ion\":0,\"dev***ock\":0,\"mut***app\":0},\"rsa***key\":\"LS0***tCg==\",\"sho***tus\":0,\"msg***ond\":0,\"avatar\":\"\",\"ref***ken\":\"\",\"exp***sAt\":0,\"id\":\"412***95d\",\"nic***ame\":\"leng\"}","app_token":"a48***8d5","im.token":"a48***8d5","auth.loginInfo":"{\"uid\":\"412***95d\",\"app_id\":\"\",\"name\":\"leng\",\"use***ame\":\"008***709\",\"sex\":1,\"cat***ory\":\"\",\"sho***_no\":\"yww***Vjs\",\"zone\":\"0086\",\"phone\":\"137***709\",\"token\":\"a48***8d5\",\"cha***pwd\":\"\",\"loc***pwd\":\"\",\"loc***ute\":0,\"setting\":{\"sea***one\":1,\"sea***ort\":1,\"new***ice\":1,\"msg***ail\":1,\"voi***_on\":1,\"sho***_on\":1,\"off***ion\":0,\"dev***ock\":0,\"mut***app\":0},\"rsa***key\":\"LS0***tCg==\",\"sho***tus\":0,\"msg***ond\":0,\"avatar\":\"\",\"ref***ken\":\"\",\"exp***sAt\":0}"} |
| V2-01-05 密码错误提示 | FAIL | 错误密码后进入主页=false; API 调用数=0; 错误提示可见=true; URL=http://172.18.58.156:5173/#/pages/login/index; storage={"__DC_STAT_UUID":"1780804378242651066"} |
| V2-02-01 进入注册页 | FAIL | URL=http://172.18.58.156:5173/#/pages/login/register; 基础字段=true; 确认密码字段=false; inputs=[{"i":0,"type":"number","placeholder":null,"value":""},{"i":1,"type":"number","placeholder":null,"value":""},{"i":2,"type":"text","placeholder":null,"value":""},{"i":3,"type":"password","placeholder":null,"value":""}] |
| V2-02-02 注册字段校验 | FAIL | 空字段错误=true; 非11位手机号错误=true; 7位密码8位规则错误=false; 确认密码字段存在=false; URL=http://172.18.58.156:5173/#/pages/chat/index |
| V2-02-03 验证码获取 | FAIL | 倒计时可见=true; SMS API 调用数=0; body=返回登录<br>加入 AgentHub<br>开启您的智能化工作协同体验<br>手机号<br>验证码<br>短信验证码<br>59s<br>昵称<br>请输入您的昵称<br>密码<br>密码 (不少于6位)<br>注册账号<br><br>验证码发送成功 |
| V2-02-04 B 注册成功 | FAIL | 自动登录=false; 注册 API 调用数=0; realTokenKeys=true; URL=http://172.18.58.156:5173/#/pages/login/register; storage={"app_user":"{\"uid\":\"a0c***77a\",\"app_id\":\"\",\"name\":\"测试员B\",\"use***ame\":\"008***001\",\"sex\":1,\"cat***ory\":\"\",\"sho***_no\":\"ynOvppS\",\"zone\":\"0086\",\"phone\":\"138***001\",\"token\":\"d73***e9e\",\"cha***pwd\":\"\",\"loc***pwd\":\"\",\"loc***ute\":0,\"setting\":{\"sea***one\":1,\"sea***ort\":1,\"new***ice\":1,\"msg***ail\":1,\"voi***_on\":1,\"sho***_on\":1,\"off***ion\":0,\"dev***ock\":0,\"mut***app\":0},\"rsa***key\":\"LS0***tCg==\",\"sho***tus\":0,\"msg***ond\":0,\"avatar\":\"\",\"ref***ken\":\"\",\"exp***sAt\":0}","__DC_STAT_UUID":"17808043839636496088","app_token":"d73***e9e","auth.uid":"a0cd1e35f2c9494d9be852004641277a","auth.accessToken":"d73***e9e","auth.loginInfo":"{\"uid\":\"a0c***77a\",\"app_id\":\"\",\"name\":\"测试员B\",\"use***ame\":\"008***001\",\"sex\":1,\"cat***ory\":\"\",\"sho***_no\":\"ynOvppS\",\"zone\":\"0086\",\"phone\":\"138***001\",\"token\":\"d73***e9e\",\"cha***pwd\":\"\",\"loc***pwd\":\"\",\"loc***ute\":0,\"setting\":{\"sea***one\":1,\"sea***ort\":1,\"new***ice\":1,\"msg***ail\":1,\"voi***_on\":1,\"sho***_on\":1,\"off***ion\":0,\"dev***ock\":0,\"mut***app\":0},\"rsa***key\":\"LS0***tCg==\",\"sho***tus\":0,\"msg***ond\":0,\"avatar\":\"\",\"ref***ken\":\"\",\"exp***sAt\":0}"} |

## Screenshots
### V2-01-01 H5 启动可达
- sections/agenthub_ui/.ai/tests/screenshots/v2-20260607-115248/V2-01-01/01_root_375x844_mobile.png
### V2-01-02 账号 A 登录
- sections/agenthub_ui/.ai/tests/screenshots/v2-20260607-115248/V2-01-02/01_A_login_form_filled.png
- sections/agenthub_ui/.ai/issue/screenshots/v2-20260607-115248/V2-01-02/02_after_login_A.png
### V2-01-03 token 持久化
- sections/agenthub_ui/.ai/tests/screenshots/v2-20260607-115248/V2-01-03/01_after_refresh_A.png
### V2-01-05 密码错误提示
- sections/agenthub_ui/.ai/tests/screenshots/v2-20260607-115248/V2-01-05/01_wrong_password_filled.png
- sections/agenthub_ui/.ai/issue/screenshots/v2-20260607-115248/V2-01-05/02_wrong_password_result.png
### V2-02-01 进入注册页
- sections/agenthub_ui/.ai/issue/screenshots/v2-20260607-115248/V2-02-01/01_register_page.png
### V2-02-02 注册字段校验
- sections/agenthub_ui/.ai/tests/screenshots/v2-20260607-115248/V2-02-02/01_empty_submit.png
- sections/agenthub_ui/.ai/tests/screenshots/v2-20260607-115248/V2-02-02/02_invalid_phone_code.png
- sections/agenthub_ui/.ai/issue/screenshots/v2-20260607-115248/V2-02-02/03_seven_char_password_result.png
### V2-02-03 验证码获取
- sections/agenthub_ui/.ai/issue/screenshots/v2-20260607-115248/V2-02-03/01_get_sms_code.png
### V2-02-04 B 注册成功
- sections/agenthub_ui/.ai/tests/screenshots/v2-20260607-115248/V2-02-04/01_B_register_form_filled.png
- sections/agenthub_ui/.ai/issue/screenshots/v2-20260607-115248/V2-02-04/02_B_register_result.png

## Diagnostics
- API calls matching real backend routes: 4
- Request failures: 0
- Diagnostics log: sections/agenthub_ui/.ai/tests/screenshots/v2-20260607-115248/diagnostics.log
- Accounts file: sections/agenthub_ui/.ai/tests/screenshots/v2-20260607-115248/accounts.json