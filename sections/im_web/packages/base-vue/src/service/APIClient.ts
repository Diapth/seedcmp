import axios, { AxiosRequestConfig } from 'axios';
import { StorageService } from './StorageService';
import { eventBus } from './EventBus';

export const apiClient = axios.create({
  baseURL: 'http://100.79.157.76:8090/v1/',
  timeout: 10000,
});

// Request interceptor to inject custom token header
apiClient.interceptors.request.use((config) => {
  const token = StorageService.get('token');
  if (token) {
    config.headers['token'] = token;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor to intercept 401 and trigger kickout
apiClient.interceptors.response.use((response) => {
  return response.data;
}, (error) => {
  if (error.response?.status === 401) {
    eventBus.emit('kickout');
  }
  return Promise.reject({
    error,
    msg: error.response?.data?.msg || '请求失败',
    status: error.response?.status
  });
});

// Helper for DELETE request with body
export const apiDelete = (url: string, data?: any, config?: AxiosRequestConfig) => {
  return apiClient.delete(url, {
    ...config,
    data
  });
};
