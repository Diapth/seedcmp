import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useUserStore } from '@tsdaodao/datasource-vue';
import { authApi } from '@tsdaodao/datasource-vue';
export const useLoginStore = defineStore('loginState', () => {
    const state = ref('idle');
    const userStore = useUserStore();
    async function loginWithPassword(phone, codeOrPass) {
        state.value = 'loading';
        try {
            const res = await userStore.login({
                login_type: 0,
                phone,
                password: codeOrPass
            });
            state.value = 'logged_in';
            return res;
        }
        catch (err) {
            state.value = 'idle';
            throw err;
        }
    }
    async function sendSmsCode(phone) {
        state.value = 'loading';
        try {
            await authApi.getRegisterSmsCode(phone);
            state.value = 'sms_sent';
        }
        catch (err) {
            state.value = 'idle';
            throw err;
        }
    }
    return {
        state,
        loginWithPassword,
        sendSmsCode
    };
});
