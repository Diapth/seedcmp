# v3-25-browser-stability-r1-202606011415

- Target URL: http://localhost:3016
- Accounts: 18337488675, 13733632709
- Group: TestGroup1
- Checks passed: 20
- Checks skipped: 1
- Checks failed: 0
- Console errors: 0
- Page errors: 0
- Failed/network 5xx requests: 28 (`net::ERR_ABORTED` only during navigation/page close; no captured 5xx)

## Checks
- PASS: A login - 18337488675
- PASS: cat console reachable
- PASS: cat console auth type field
- PASS: cat console account ref field
- PASS: api key mode model field
- PASS: oauth mode hides api model field
- PASS: conversation context menu labels - 置顶 / 消息免打扰 / 隐藏会话 / 删除会话
- PASS: A open group - TestGroup113:52leng_test_updated： v3-25-browser-20260601055240 猫猫 soft trigger smoke
- PASS: clowder panel auto reply modes
- PASS: B login - 13733632709
- PASS: B open group - TestGroup113:52leng_test_updated： v3-25-browser-20260601055240 猫猫 soft trigger smoke
- PASS: two-account A message visible on B - v3-25-browser-stability-r1-202606011415 A-to-B visible
- PASS: two-account B message visible on A - v3-25-browser-stability-r1-202606011415 B-to-A avatar
- PASS: message context menu labels - 引用回复 / 复制 / 本地删除
- PASS: quote reply preview appears
- PASS: group avatar context menu labels - @TA / 查看资料
- PASS: avatar @TA inserts mention draft - @123 
- PASS: avatar profile drawer opens
- PASS: A after reload open group - TestGroup114:16123： v3-25-browser-stability-r1-202606011415 B-to-A avatar
- PASS: two-account messages persist after reload
- SKIPPED: soft 猫猫 trigger produced clowder reply - No Clowder reply observed within 45s in current live backend.

## Screenshots
- 00-a-after-login: /home/leng/.config/superpowers/worktrees/seedcmp/v3-25-smoke/sections/im_web/.ai/V3.0/tests-e2e/v3-25-browser-stability-r1-202606011415/00-a-after-login.png
- 01-cat-console-auth-methods: /home/leng/.config/superpowers/worktrees/seedcmp/v3-25-smoke/sections/im_web/.ai/V3.0/tests-e2e/v3-25-browser-stability-r1-202606011415/01-cat-console-auth-methods.png
- 02-conversation-menu: /home/leng/.config/superpowers/worktrees/seedcmp/v3-25-smoke/sections/im_web/.ai/V3.0/tests-e2e/v3-25-browser-stability-r1-202606011415/02-conversation-menu.png
- 03-clowder-auto-reply-modes: /home/leng/.config/superpowers/worktrees/seedcmp/v3-25-smoke/sections/im_web/.ai/V3.0/tests-e2e/v3-25-browser-stability-r1-202606011415/03-clowder-auto-reply-modes.png
- 04-b-group-open: /home/leng/.config/superpowers/worktrees/seedcmp/v3-25-smoke/sections/im_web/.ai/V3.0/tests-e2e/v3-25-browser-stability-r1-202606011415/04-b-group-open.png
- 05-a-after-send: /home/leng/.config/superpowers/worktrees/seedcmp/v3-25-smoke/sections/im_web/.ai/V3.0/tests-e2e/v3-25-browser-stability-r1-202606011415/05-a-after-send.png
- 06-b-after-receive: /home/leng/.config/superpowers/worktrees/seedcmp/v3-25-smoke/sections/im_web/.ai/V3.0/tests-e2e/v3-25-browser-stability-r1-202606011415/06-b-after-receive.png
- 07-message-quote-preview: /home/leng/.config/superpowers/worktrees/seedcmp/v3-25-smoke/sections/im_web/.ai/V3.0/tests-e2e/v3-25-browser-stability-r1-202606011415/07-message-quote-preview.png
- 08-avatar-mention-draft: /home/leng/.config/superpowers/worktrees/seedcmp/v3-25-smoke/sections/im_web/.ai/V3.0/tests-e2e/v3-25-browser-stability-r1-202606011415/08-avatar-mention-draft.png
- 09-avatar-profile-drawer: /home/leng/.config/superpowers/worktrees/seedcmp/v3-25-smoke/sections/im_web/.ai/V3.0/tests-e2e/v3-25-browser-stability-r1-202606011415/09-avatar-profile-drawer.png
- 10-a-after-reload: /home/leng/.config/superpowers/worktrees/seedcmp/v3-25-smoke/sections/im_web/.ai/V3.0/tests-e2e/v3-25-browser-stability-r1-202606011415/10-a-after-reload.png
- 11-soft-trigger-after-send: /home/leng/.config/superpowers/worktrees/seedcmp/v3-25-smoke/sections/im_web/.ai/V3.0/tests-e2e/v3-25-browser-stability-r1-202606011415/11-soft-trigger-after-send.png
