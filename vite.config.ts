import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['lucide-react'],
    exclude: [],
  },
  server: {
    host: '0.0.0.0', // Permite acesso de outros dispositivos na rede
    port: 5173,
    strictPort: false,
    open: true,
  },
  build: {
    commonjsOptions: {
      include: [/lucide-react/, /node_modules/],
    },
  },
});
