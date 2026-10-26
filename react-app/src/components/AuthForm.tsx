import { useState, type FormEvent } from 'react'

export type FormMessage = { text: string; kind: 'error' | 'success' }

type Props = {
  submitLabel: string
  pendingLabel: string
  message: FormMessage | null
  // 送信を実行する。送信中はボタンを無効にする。
  onSubmit: (username: string, password: string) => Promise<void>
}

const inputClass =
  'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-primary-blue outline-none transition duration-150'

export default function AuthForm({ submitLabel, pendingLabel, message, onSubmit }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      await onSubmit(username, password)
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
          ユーザー名
        </label>
        <input
          type="text"
          id="username"
          name="username"
          required
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          パスワード
        </label>
        <input
          type="password"
          id="password"
          name="password"
          required
          autoComplete={submitLabel === 'ログイン' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>

      {message && (
        <div
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={`text-sm ${message.kind === 'error' ? 'text-red-500' : 'text-green-500'}`}
        >
          {message.text}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-primary-blue text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition duration-150 shadow-md disabled:opacity-60"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  )
}
