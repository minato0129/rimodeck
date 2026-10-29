import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Index from './pages/Index'
import Login from './pages/Login'
import Remote from './pages/Remote'
import Signup from './pages/Signup'
import Watch from './pages/Watch'

// Viewer は pdf.js と QR コードのライブラリを使うので、開いたときに初めて読み込む
const Viewer = lazy(() => import('./pages/Viewer'))

// ルートは Go 版と同じ URL にしてある(/、/login、/signup、/viewer、/remote)。/watch/:token は傾聴者用の画面(新規)。
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/viewer"
        element={
          <Suspense fallback={null}>
            <Viewer />
          </Suspense>
        }
      />
      <Route path="/remote" element={<Remote />} />
      <Route path="/watch/:token" element={<Watch />} />
    </Routes>
  )
}
