import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')
  const demoMode = env.VITE_DEMO_MODE ?? (mode === 'development' || mode === 'test' ? 'true' : 'false')
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_DEMO_MODE': JSON.stringify(demoMode),
    },
    server: {
      proxy: {
        '/api': 'http://127.0.0.1:8000',
        '/health': 'http://127.0.0.1:8000',
      },
    },
  }
})
