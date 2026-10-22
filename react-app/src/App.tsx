import { Route, Routes } from 'react-router-dom'
import Index from './pages/Index'
import Login from './pages/Login'
import Remote from './pages/Remote'
import Signup from './pages/Signup'
import Viewer from './pages/Viewer'

// ルートは Go 版と同じ URL にしてある(/、/login、/signup、/viewer、/remote)。
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/viewer" element={<Viewer />} />
      <Route path="/remote" element={<Remote />} />
    </Routes>
  )
}
