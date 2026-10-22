// 移植元: go-server/src/signup.html / assets/js/signup.js
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthForm, { type FormMessage } from '../components/AuthForm'
import AuthLayout from '../components/AuthLayout'
import { postCredentials } from '../lib/auth'

export default function Signup() {
  const navigate = useNavigate()
  const [message, setMessage] = useState<FormMessage | null>(null)
  const timer = useRef<number | undefined>(undefined)

  // 登録後の自動移動を、画面を離れたときに止める
  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function handleSubmit(username: string, password: string) {
    setMessage(null)
    try {
      const response = await postCredentials('/signup', { username, password })
      if (response.ok) {
        setMessage({ text: '登録が完了しました！ログイン画面へ移動します。', kind: 'success' })
        timer.current = window.setTimeout(() => navigate('/login'), 2000)
      } else {
        const detail = await response.text()
        setMessage({ text: '登録に失敗しました: ' + detail, kind: 'error' })
      }
    } catch {
      setMessage({ text: 'ネットワークエラーが発生しました。', kind: 'error' })
    }
  }

  return (
    <AuthLayout
      subtitle="新しいアカウントを作成します"
      footer={
        <>
          すでにアカウントをお持ちですか？{' '}
          <Link to="/login" className="text-primary-blue font-semibold hover:underline">
            ログイン
          </Link>
        </>
      }
    >
      <AuthForm
        submitLabel="アカウント作成"
        pendingLabel="処理中..."
        message={message}
        onSubmit={handleSubmit}
      />
    </AuthLayout>
  )
}
