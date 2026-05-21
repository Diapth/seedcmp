<template>
  <div class="welcome-container">
    <div class="welcome-inner">
      <!-- High-end Minimalist Dynamic Logo Placeholder -->
      <div class="logo-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="welcome-logo">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <h3 class="welcome-title">开始你的极简通讯</h3>
      <p class="welcome-desc">选择左侧列表中的会话，开启纯净、高响应的高阶即时通讯。</p>
    </div>
  </div>
</template>

<style scoped>
.welcome-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background-color: var(--bg-primary);
  color: var(--text-secondary);
}

.welcome-inner {
  text-align: center;
  max-width: 320px;
  padding: 24px;
}

.logo-box {
  width: 64px;
  height: 64px;
  margin: 0 auto 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-secondary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
}

.welcome-logo {
  width: 32px;
  height: 32px;
  color: var(--text-primary);
}

.welcome-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.welcome-desc {
  font-size: 13px;
  line-height: 1.6;
}
</style>
