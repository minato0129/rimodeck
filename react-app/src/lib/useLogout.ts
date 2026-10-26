import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { logoutRequest } from './api'
import { clearUsername } from './session'

// ログアウト: サーバーの /logout を呼び、保存したユーザー名を消してログイン画面へ。
// サーバーへの通信に失敗しても、ログアウト自体は続ける(現行版と同じ)。
export function useLogout() {
  const navigate = useNavigate()
  return useCallback(async () => {
    try {
      await logoutRequest()
    } catch (error) {
      console.error('Logout request failed:', error)
    }
    clearUsername()
    navigate('/login')
  }, [navigate])
}
