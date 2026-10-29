import { useState } from 'react'
import Icon from './Icon'
import { MAX_QUESTION_LENGTH, sendQuestion } from '../lib/questions'

type Props = {
  token: string
  total: number
  // 追従モードのときは、質問するページを選べる。自分で動かすモードのときは、いま見ているページに固定
  following: boolean
  initialPage: number
  draft: string
  onDraftChange: (value: string) => void
  onSent: () => void
  onClose: () => void
}

// 傾聴者が、発表者に匿名で質問を送るシート
export default function AskForm({ token, total, following, initialPage, draft, onDraftChange, onSent, onClose }: Props) {
  // 開いた時点のページを初期値にする(発表者が先に進んでも、選んだページは変わらない)
  const [page, setPage] = useState(initialPage)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const content = draft.trim()
  const canSend = content.length > 0 && !sending

  async function submit() {
    if (!canSend) return
    setSending(true)
    setError(null)
    try {
      await sendQuestion(token, page, content)
      onDraftChange('')
      onSent()
    } catch (e) {
      setError(e instanceof Error ? e.message : '質問を送れませんでした。')
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-2xl bg-white p-4 shadow-lg"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="ask-title" className="text-lg font-bold">
            発表者に質問する
          </h2>
          <button type="button" aria-label="閉じる" onClick={onClose} className="text-gray-500">
            <Icon name="close" />
          </button>
        </div>

        <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
          <span className="shrink-0">質問するページ</span>
          {following ? (
            <select
              value={page}
              onChange={(e) => setPage(Number(e.target.value))}
              className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-base"
            >
              {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} ページ
                </option>
              ))}
            </select>
          ) : (
            <span className="font-medium">{page} ページ(いま見ているページ)</span>
          )}
        </label>

        <textarea
          aria-label="質問"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          maxLength={MAX_QUESTION_LENGTH}
          rows={4}
          placeholder="質問を入力(匿名で送られます)"
          className="w-full rounded-lg border border-gray-300 p-2 text-base focus:border-primary-blue focus:outline-none focus:ring-1 focus:ring-primary-blue"
        />
        <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
          <span role="alert" className="text-red-600">
            {error}
          </span>
          <span>
            {draft.length} / {MAX_QUESTION_LENGTH}
          </span>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          className="mt-3 w-full rounded-lg bg-primary-blue px-4 py-3 text-base font-medium text-white disabled:opacity-40"
        >
          {sending ? '送信中...' : '送信'}
        </button>
      </div>
    </div>
  )
}
