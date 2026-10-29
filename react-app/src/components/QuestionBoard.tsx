import type { Question } from '../lib/questions'

type Props = {
  questions: Question[]
  currentPage: number
  highlightId: number | null
}

// 発表者モードの別ウィンドウ(プロジェクターに映す、傾聴者みんなが見る画面)に出す質問の一覧。
// 見るだけの画面。回答済み・削除は、メインの画面で行う(回答済みにすると、ここから消える)
export default function QuestionBoard({ questions, currentPage, highlightId }: Props) {
  // 新しい質問を上に。回答済みは映さない
  const shown = questions.filter((q) => !q.answered).sort((a, b) => b.id - a.id)

  return (
    <aside
      aria-label="質問"
      className="flex w-96 shrink-0 flex-col border-l border-gray-200 bg-viewer-bg"
    >
      <h2 className="border-b border-gray-200 p-4 text-xl font-bold">質問 ({shown.length})</h2>
      <ul className="flex-1 space-y-3 overflow-y-auto p-4">
        {shown.length === 0 && <li className="text-center text-gray-500">質問はまだありません。</li>}
        {shown.map((q) => (
          <li
            key={q.id}
            className={`rounded-lg border p-4 transition-colors duration-500 ${
              q.id === highlightId
                ? 'border-primary-blue bg-primary-blue/10'
                : q.page === currentPage
                  ? 'border-gray-400 bg-white'
                  : 'border-gray-200 bg-white'
            }`}
          >
            <span className="mb-1 inline-block rounded-full bg-primary-blue/10 px-2 py-0.5 text-sm font-medium text-primary-blue">
              {q.page} ページ
            </span>
            <p className="whitespace-pre-wrap break-words text-xl leading-snug">{q.content}</p>
          </li>
        ))}
      </ul>
    </aside>
  )
}
