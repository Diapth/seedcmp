import { ref } from 'vue';
import { apiClient } from '../service/APIClient';
import { Const } from '../service/Const';
const remoteConfig = ref({
    revoke_second: Const.defaultRevokeSecond
});
let isFetched = false;
export function useRemoteConfig() {
    const fetchRemoteConfig = async () => {
        if (isFetched)
            return remoteConfig.value;
        try {
            const res = await apiClient.get('/common/appconfig');
            if (res && res.revoke_second) {
                remoteConfig.value.revoke_second = Number(res.revoke_second);
            }
            isFetched = true;
        }
        catch (e) {
            console.warn('Failed to fetch remote config, using default', e);
        }
        return remoteConfig.value;
    };
    return {
        remoteConfig,
        fetchRemoteConfig
    };
}
