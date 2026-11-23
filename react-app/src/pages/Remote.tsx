// 移植元: go-server/src/phone.html / assets/js/phone.js
import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import RemoteLayoutEditor from '../components/RemoteLayoutEditor'
import { useRemote, type ConnectionState, type RemoteCommand } from '../lib/remote'
import {
  BUTTONS,
  COLORS,
  DEFAULT_LAYOUT,
  HEIGHT_CLASS,
  ICON_CLASS,
  TEXT_CLASS,
  resetLayout,
  saveLayout,
  useRemoteLayout,
  type RemoteLayout,
} from '../lib/remoteLayout'

const STATUS: Record<ConnectionState, { text: string; box: string; dot: string }> = {
  'missing-id': {
    text: '接続エラー: QRコードを再読み込みしてください。',
    box: 'bg-red-500/20 text-red-700',
    dot: 'bg-red-500',
  },
  connecting: { text: '接続中...', box: 'bg-yellow-500/20 text-yellow-700', dot: 'bg-yellow-500' },
  connected: { text: '接続済み', box: 'bg-green-500/20 text-green-700', dot: 'bg-green-500' },
  closed: { text: 'サーバーから切断されました', box: 'bg-red-500/20 text-red-700', dot: 'bg-red-500' },
  error: { text: '接続エラーが発生しました', box: 'bg-red-500/20 text-red-700', dot: 'bg-red-500' },
}

export default function Remote() {
  const [params] = useSearchParams()
  const viewerId = params.get('id')
  const { state, send } = useRemote(
    viewerId,
    useCallback((text: string) => alert(text), []),
  )
  const status = STATUS[state]

  function sendCommand(command: RemoteCommand) {
    if (!send(command)) alert('サーバーに接続されていないか、正しく読み込まれていません。')
  }

  // 編集モード。draft が null のときは、通常の操作画面
  const { layout, setLayout, error: loadError } = useRemoteLayout(viewerId)
  const [draft, setDraft] = useState<RemoteLayout | null>(null)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const editing = draft !== null

  function startEdit() {
    setDraft(layout ?? DEFAULT_LAYOUT)
    setEditError(null)
  }
  async function finishEdit() {
    if (!draft || !viewerId) return
    setSaving(true)
    setEditError(null)
    try {
      setLayout(await saveLayout(viewerId, draft))
      setDraft(null)
    } catch (e) {
      setEditError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }
  async function resetEdit() {
    if (!viewerId || !window.confirm('ボタンの配置を、初期状態に戻しますか?')) return
    setSaving(true)
    setEditError(null)
    try {
      await resetLayout(viewerId)
      setLayout(DEFAULT_LAYOUT)
      setDraft(null)
    } catch (e) {
      setEditError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  // この画面の角丸は、現行版の tailwind.config(lg=0.75rem, xl=1rem)に合わせて個別に指定する。
  // テーマ全体で変えると、他の画面の見た目まで変わってしまうため。
  return (
    <div className="bg-background-light font-sans flex min-h-screen w-full flex-col touch-manipulation">
      <div className="flex items-center p-4 pb-2 justify-between bg-background-light">
        <div className="flex size-12 shrink-0 items-center">
          <Icon name="arrow_back_ios_new" className="text-gray-800 text-3xl" />
        </div>
        <h1 className="text-gray-800 text-xl font-bold tracking-tight">
          {editing ? 'ボタンの編集' : 'プレゼンテーション リモート'}
        </h1>
        <div className="flex w-12 items-center justify-end">
          <button
            type="button"
            aria-label={editing ? '編集モードを終了' : '編集モード'}
            aria-pressed={editing}
            onClick={() => (editing ? setDraft(null) : startEdit())}
            disabled={!viewerId || layout === undefined}
            className={`flex items-center justify-center rounded-[0.75rem] h-12 p-0 disabled:opacity-30 ${
              editing ? 'text-primary-blue' : 'text-gray-800'
            }`}
          >
            <Icon name="settings" className="text-3xl" />
          </button>
        </div>
      </div>

      <div className="p-4 pt-2">
        <div
          role="status"
          className={`flex w-full items-center justify-center rounded-[0.75rem] p-2 text-sm font-medium ${status.box}`}
        >
          <span className={`mr-2 h-2.5 w-2.5 rounded-full ${status.dot}`} />
          <span>{status.text}</span>
        </div>
      </div>

      {draft ? (
        <RemoteLayoutEditor
          draft={draft}
          onChange={setDraft}
          onSave={finishEdit}
          onCancel={() => setDraft(null)}
          onReset={resetEdit}
          saving={saving}
          error={editError}
        />
      ) : (
        <>
          {loadError && (
            <p role="alert" className="mx-4 rounded-[0.75rem] bg-yellow-500/20 p-2 text-center text-xs text-yellow-700">
              保存した配置を読み込めなかったため、初期の配置で表示しています。({loadError})
            </p>
          )}
          {/* 余った高さは、行で分け合って広がる。初期状態は 1 行なので、これまでと同じ見た目になる */}
          <div className="grid grow grid-cols-2 gap-4 p-4">
            {layout?.buttons.map((button) => (
              <button
                key={button.id}
                type="button"
                onClick={() => sendCommand(button.id)}
                className={`flex flex-col items-center justify-center gap-3 rounded-[1rem] shadow-lg transition-all active:shadow-none ${
                  button.width === 'full' ? 'col-span-2' : ''
                } ${HEIGHT_CLASS[button.height]} ${COLORS[button.color].button}`}
              >
                <Icon name={BUTTONS[button.id].icon} className={`opacity-70 ${ICON_CLASS[button.textSize]}`} />
                <span className={`font-bold ${TEXT_CLASS[button.textSize]}`}>{BUTTONS[button.id].label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
