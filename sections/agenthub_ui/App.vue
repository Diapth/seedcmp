<script>
	import { initSystemNotificationClickHandler } from '@/composables/useSystemNotification';

	export default {
		onLaunch: function() {
			console.log('App Launch');
			const savedTheme = uni.getStorageSync('app_theme') || 'light';
			// Set initial theme class to page element for desktop/H5
			// #ifdef H5
			document.documentElement.className = `theme-${savedTheme}`;
			// #endif
			initSystemNotificationClickHandler();
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
