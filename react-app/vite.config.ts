import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Go サーバーの接続先。Docker では compose が go-server に向け、ローカル実行では localhost を使う。
const apiTarget = process.env.VITE_API_TARGET ?? 'http://localhost:1323'

// /login と /signup は「ページ(GET)」と「API(POST)」で同じ URL を使っている。
// ブラウザのページ遷移(GET + text/html)は React に任せ、それ以外だけを Go へ流す。
const apiOrSpa = {
  target: apiTarget,
  changeOrigin: true,
  bypass(req: { method?: string; headers: { accept?: string }; url?: string }) {
    if (req.method === 'GET' && req.headers.accept?.includes('text/html')) {
      return req.url
    }
  },
}

const api = { target: apiTarget, changeOrigin: true }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Go が PDF を /assets/* で配信しているため、ビルド成果物は /static/ 以下に出して衝突を避ける
    assetsDir: 'static',
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    proxy: {
      '/login': apiOrSpa,
      '/signup': apiOrSpa,
      '/logout': api,
      '/upload': api,
      '/pdfs': api,
      '/delete-pdf': api,
      '/note': api,
      '/assets': api,
      '/shared': api,
      '/share': api,
      '/question': api,
      '/ws': { ...api, ws: true },
    },
  },
})
