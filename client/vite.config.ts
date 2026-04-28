import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseTarget = env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api/admin': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/auth/v1': {
          target: supabaseTarget,
          changeOrigin: true,
        },
        '/rest/v1': {
          target: supabaseTarget,
          changeOrigin: true,
        },
        '/storage/v1': {
          target: supabaseTarget,
          changeOrigin: true,
        },
        '/realtime/v1': {
          target: supabaseTarget,
          changeOrigin: true,
          ws: true,
        },
        '/functions/v1': {
          target: supabaseTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
