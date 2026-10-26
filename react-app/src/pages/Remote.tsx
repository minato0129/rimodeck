// 移植元: go-server/src/phone.html / assets/js/phone.js
import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { useRemote, type ConnectionState } from '../lib/remote'

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

  function sendSlide(command: 'next' | 'prev') {
    if (!send(command)) alert('サーバーに接続されていないか、正しく読み込まれていません。')
  }

  // この画面の角丸は、現行版の tailwind.config(lg=0.75rem, xl=1rem)に合わせて個別に指定する。
  // テーマ全体で変えると、他の画面の見た目まで変わってしまうため。
  return (
    <div className="bg-background-light font-sans flex min-h-screen w-full flex-col touch-manipulation">
      <div className="flex items-center p-4 pb-2 justify-between bg-background-light">
        <div className="flex size-12 shrink-0 items-center">
          <Icon name="arrow_back_ios_new" className="text-gray-800 text-3xl" />
        </div>
        <h1 className="text-gray-800 text-xl font-bold tracking-tight">プレゼンテーション リモート</h1>
        <div className="flex w-12 items-center justify-end">
          <button
            type="button"
            aria-label="設定"
            className="flex items-center justify-center rounded-[0.75rem] h-12 text-gray-800 p-0"
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

      <div className="grow flex justify-between items-stretch p-4 gap-4">
        {(
          [
            ['prev', 'arrow_back_ios', '前のスライド'],
            ['next', 'arrow_forward_ios', '次のスライド'],
          ] as const
        ).map(([command, icon, label]) => (
          <button
            key={command}
            type="button"
            onClick={() => sendSlide(command)}
            className="flex flex-col items-center justify-center gap-4 rounded-[1rem] bg-white text-gray-700 flex-1 shadow-lg active:shadow-none active:bg-gray-100 transition-all"
          >
            <Icon name={icon} className="text-gray-500 text-[48px]" />
            <span className="text-lg font-bold">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
