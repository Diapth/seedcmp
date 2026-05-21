import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ArcoVue from '@arco-design/web-vue';
import '@arco-design/web-vue/dist/arco.css';
import '@tsdaodao/base-vue'; // Overrides Arco styles and sets global base styles
import App from './App.vue';
import { router } from './router';
const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);
app.use(ArcoVue);
app.mount('#app');
