import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          const normalizedId = id.replace(/\\/g, '/')
          if (normalizedId.includes('/react/') || normalizedId.includes('/react-dom/') || normalizedId.includes('/scheduler/')) {
            return 'vendor-react'
          }

          if (normalizedId.includes('/@supabase/')) {
            return 'vendor-supabase'
          }

          if (normalizedId.includes('/@capacitor/') || normalizedId.includes('/capacitor-razorpay/')) {
            return 'vendor-capacitor'
          }

          return 'vendor'
        },
      },
    },
  },
})
