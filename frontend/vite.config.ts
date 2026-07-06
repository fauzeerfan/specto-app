import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        '/api': {
          // Backend NestJS lokal. Override dengan VITE_PROXY_TARGET di file .env bila perlu (mis. IP LAN).
          target: env.VITE_PROXY_TARGET || 'http://localhost:3001',
          changeOrigin: true,
          ws: true,
          secure: false,
        },
      },
    },
  };
});
