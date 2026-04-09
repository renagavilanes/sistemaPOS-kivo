import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { projectId } from './utils/supabase/info.tsx'
import { superadminEdgeFunctionSlug } from './utils/supabase/superadminEdgeSlug.ts'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  // Mismo origen en dev: evita CORS/preflight bloqueado por el gateway de Supabase (OPTIONS sin JWT).
  server: {
    // Evita que navegadores móviles se queden con JS viejo.
    headers: {
      'Cache-Control': 'no-store',
    },
    proxy: {
      [`/functions/v1/${superadminEdgeFunctionSlug}`]: {
        target: `https://${projectId}.supabase.co`,
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
