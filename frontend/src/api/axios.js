import axios from 'axios';

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
});

export const setupInterceptors = (auth) => {
    apiClient.interceptors.request.use(
        (config) => {
            if (auth && auth.user && auth.user.access_token) {
                config.headers['Authorization'] = `Bearer ${auth.user.access_token}`;
            }
            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );
};

export default apiClient;
