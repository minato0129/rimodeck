import Icon from './Icon'

type Props = {
  text: string
  loading: boolean
  failed: boolean
  onChange: (value: string) => void
}

// 画面の右側のスライドメモ(幅が狭い画面では隠す)
export default function NotePanel({ text, loading, failed, onChange }: Props) {
  return (
    <aside className="hidden w-80 shrink-0 flex-col gap-4 border-l border-gray-200 bg-viewer-bg p-4 lg:flex">
      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-lg font-semibold mb-2">スライドメモ</h3>
        <details className="group" open>
          <summary className="flex cursor-pointer items-center justify-between rounded-lg bg-secondary/50 p-2 text-sm font-medium transition-colors hover:bg-secondary/70">
            メモ
            <Icon name="expand_more" className="transition-transform group-open:rotate-180" />
          </summary>
          <textarea
            aria-label="スライドメモ"
            value={text}
            // 読み込み中に入力しても、読み込み結果で上書きされてしまうので、入力できないようにする
            readOnly={loading}
            onChange={(e) => onChange(e.target.value)}
            placeholder="このスライドに関するメモを追加..."
            rows={25}
            className="mt-2 w-full rounded-lg border border-gray-300 bg-transparent p-2 text-sm font-normal text-viewer-text focus:border-primary-blue focus:outline-none focus:ring-1 focus:ring-primary-blue"
          />
          {failed && (
            <p role="alert" className="mt-2 text-xs text-red-500">
              メモを読み込めませんでした。別のスライドに移ると、もう一度読み込みます。
            </p>
          )}
        </details>
      </div>
    </aside>
  )
}
