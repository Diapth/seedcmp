<script>
	import { initSystemNotificationClickHandler } from '@/composables/useSystemNotification';
	import { storage } from '@/utils/storage.js';
	import { initSdk } from '@/utils/wk-sdk.js';
	import { useAuthStore } from '@/stores/auth.js';
	import { useConversationStore } from '@/stores/conversation.js';
	import { useImStore } from '@/stores/im.js';
	import { useUserStore } from '@/stores/user.js';

	export default {
		onLaunch: async function() {
			console.log('App Launch');
			const savedTheme = storage.get('app_theme') || 'light';
			// Set initial theme class to page element for desktop/H5
			// #ifdef H5
			if (typeof document !== 'undefined') {
				document.documentElement.className = `theme-${savedTheme}`;
			}
			// #endif
			initSystemNotificationClickHandler();
			const authStore = useAuthStore();
			const conversationStore = useConversationStore();
			const userStore = useUserStore();
			const imStore = useImStore();
			try {
				const loggedIn = await authStore.bootstrap();
				if (!loggedIn) return;
				await userStore.fetchMe().catch((err) => {
					console.warn('[AUTH_BOOTSTRAP] fetchMe failed', err);
				});
				await imStore.fetchImAddress().catch((err) => {
					console.warn('[AUTH_BOOTSTRAP] fetchImAddress failed', err);
				});
				await conversationStore.fetchConversations().catch((err) => {
					console.warn('[AUTH_BOOTSTRAP] fetchConversations failed', err);
				});
				if (imStore.wsAddr) {
					await initSdk({
						uid: authStore.uid,
						token: imStore.imToken || authStore.accessToken,
						wsAddr: imStore.wsAddr
					}).catch((err) => {
						console.warn('[AUTH_BOOTSTRAP] initSdk failed', err);
					});
				}
			} catch (err) {
				console.warn('[AUTH_BOOTSTRAP] failed', err);
			}
		},
		onShow: function() {
			console.log('App Show');
		},
		onHide: function() {
			console.log('App Hide');
		}
	}
</script>

<style lang="scss">
	/* Import global design system stylesheets */
	@import "@/styles/tokens.scss";
	@import "@/styles/themes.scss";
	@import "@/styles/layout.scss";

	/* Reset global page container styles */
	page {
		width: 100%;
		height: 100%;
		margin: 0;
		padding: 0;
		box-sizing: border-box;
		background-color: var(--color-bg-base);
		color: var(--color-text-primary);
		font-family: $font-sans;
		overflow: hidden;
	}
</style>
