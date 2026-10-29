import { useEffect, useState } from 'react'
import Icon from './Icon'
import type { Question } from '../lib/questions'

type Props = {
  questions: Question[]
  currentPage: number
  failed: boolean
  onGoTo: (page: number) => void
  onToggleAnswered: (id: number, answered: boolean) => void
  onDelete: (id: number) => void
  onClose: () => void
}

type Tab = 'page' | 'all'

// 発表者が、傾聴者からの質問を見る右側のパネル(いまのページの質問/すべて)
export default function QuestionPanel({ questions, currentPage, failed, onGoTo, onToggleAnswered, onDelete, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('page')
  const [confirmId, setConfirmId] = useState<number | null>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const shown = tab === 'page' ? questions.filter((q) => q.page === currentPage) : questions
  const pageCount = questions.filter((q) => q.page === currentPage).length
  const unanswered = questions.filter((q) => !q.answered).length

  return (
    <aside
      aria-label="傾聴者からの質問"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-gray-200 bg-white shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-gray-200 p-4">
        <div>
          <h2 className="text-lg font-bold">傾聴者からの質問</h2>
          <p className="text-xs text-gray-500">
            全 {questions.length} 件 / 未回答 {unanswered} 件
          </p>
        </div>
        <button type="button" aria-label="閉じる" onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <Icon name="close" />
        </button>
      </div>

      <div role="tablist" className="flex gap-2 border-b border-gray-200 p-2">
        <TabButton active={tab === 'page'} onClick={() => setTab('page')}>
          このページ ({pageCount})
        </TabButton>
        <TabButton active={tab === 'all'} onClick={() => setTab('all')}>
          すべて ({questions.length})
        </TabButton>
      </div>

      {failed && (
        <p role="alert" className="p-4 text-xs text-red-500">
          質問の一覧を読み込めませんでした。画面を再読み込みしてください。
        </p>
      )}

      <ul className="flex-1 space-y-2 overflow-y-auto p-3">
        {shown.length === 0 && (
          <li className="p-4 text-center text-sm text-gray-500">
            {tab === 'page' ? `${currentPage} ページへの質問はありません。` : '質問はまだありません。'}
          </li>
        )}
        {shown.map((q) => (
          <li
            key={q.id}
            className={`rounded-lg border p-3 text-sm ${q.answered ? 'border-gray-200 bg-gray-50 text-gray-500' : 'border-gray-300 bg-white'}`}
          >
            <div className="mb-1 flex items-center justify-between">
              <button
                type="button"
                onClick={() => onGoTo(q.page)}
                className="rounded-full bg-primary-blue/10 px-2 py-0.5 text-xs font-medium text-primary-blue hover:bg-primary-blue/20"
              >
                {q.page} ページへ
              </button>
              <time className="text-xs text-gray-400" dateTime={q.created_at}>
                {formatTime(q.created_at)}
              </time>
            </div>
            <p className={`whitespace-pre-wrap break-words ${q.answered ? 'line-through' : ''}`}>{q.content}</p>
            <div className="mt-2 flex items-center justify-end gap-3 text-xs">
              <button
                type="button"
                onClick={() => onToggleAnswered(q.id, !q.answered)}
                className="text-gray-600 hover:text-green-700"
              >
                {q.answered ? '未回答に戻す' : '回答済みにする'}
              </button>
              {confirmId === q.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmId(null)
                      onDelete(q.id)
                    }}
                    className="font-medium text-red-600"
                  >
                    本当に削除
                  </button>
                  <button type="button" onClick={() => setConfirmId(null)} className="text-gray-500">
                    やめる
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmId(q.id)} className="text-gray-600 hover:text-red-600">
                  削除
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${active ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
    >
      {children}
    </button>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
