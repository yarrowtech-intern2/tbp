import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isNodePackage = (id: string, packageName: string) => (
  id.includes(`/node_modules/${packageName}/`)
)

const threeVendorPackages = [
  '@mediapipe',
  '@monogrid',
  '@react-three',
  '@use-gesture',
  'camera-controls',
  'detect-gpu',
  'glsl-noise',
  'hls.js',
  'its-fine',
  'maath',
  'meshline',
  'react-reconciler',
  'react-use-measure',
  'stats-gl',
  'stats.js',
  'suspend-react',
  'three',
  'three-mesh-bvh',
  'three-stdlib',
  'troika-three-text',
  'troika-three-utils',
  'troika-worker-utils',
  'tunnel-rat',
  'use-sync-external-store',
  'utility-types',
  'zustand',
]

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

          if (threeVendorPackages.some((packageName) => isNodePackage(normalizedId, packageName))) {
            return 'vendor-three'
          }

          if (isNodePackage(normalizedId, 'cobe')) {
            return 'vendor-globe'
          }

          return 'vendor'
        },
      },
    },
  },
})
