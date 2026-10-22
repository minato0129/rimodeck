// 移植元: go-server/src/login.html / assets/js/login.js
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthForm, { type FormMessage } from '../components/AuthForm'
import AuthLayout from '../components/AuthLayout'
import { postCredentials } from '../lib/auth'

export default function Login() {
  const navigate = useNavigate()
  const [message, setMessage] = useState<FormMessage | null>(null)

  async function handleSubmit(username: string, password: string) {
    setMessage(null)
    try {
      const response = await postCredentials('/login', { username, password })
      if (response.ok) {
        // 現行版と同じく、表示用にユーザー名を保存してトップへ移動する
        try {
          localStorage.setItem('username', username)
        } catch {
          // 保存できなくてもログイン自体は成功しているので続行する
        }
        navigate('/')
      } else {
        setMessage({
          text: 'ログインに失敗しました。ユーザー名またはパスワードが正しくありません。',
          kind: 'error',
        })
      }
    } catch {
      setMessage({ text: 'ネットワークエラーが発生しました。', kind: 'error' })
    }
  }

  return (
    <AuthLayout
      subtitle="アカウントにログインしてください"
      footer={
        <>
          アカウントをお持ちでないですか？{' '}
          <Link to="/signup" className="text-primary-blue font-semibold hover:underline">
            新規登録
          </Link>
        </>
      }
    >
      <AuthForm
        submitLabel="ログイン"
        pendingLabel="ログイン中..."
        message={message}
        onSubmit={handleSubmit}
      />
    </AuthLayout>
  )
}
