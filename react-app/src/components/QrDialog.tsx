import { QRCodeSVG } from 'qrcode.react'
import { useEffect } from 'react'
import Icon from './Icon'
import type { SocketStatus } from '../lib/viewer'

const STATUS: Record<SocketStatus, { text: string; box: string; dot: string }> = {
  issuing: { text: '接続IDを発行中...', box: 'bg-yellow-500/20 text-yellow-700', dot: 'bg-yellow-500' },
  issued: { text: '接続IDが発行されました', box: 'bg-green-500/20 text-green-700', dot: 'bg-green-500' },
  closed: { text: '切断されました', box: 'bg-red-500/20 text-red-700', dot: 'bg-red-500' },
  error: { text: 'エラーが発生しました', box: 'bg-red-500/20 text-red-700', dot: 'bg-red-500' },
}

type Props = {
  viewerId: string | null
  username: string
  status: SocketStatus
  onClose: () => void
}

// スマホで読み取って Remote 画面(/remote)を開くための QR コード
export default function QrDialog({ viewerId, username, status, onClose }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const remoteUrl = viewerId
    ? `${location.origin}/remote?id=${viewerId}&user=${encodeURIComponent(username)}`
    : null
  const s = STATUS[status]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-title"
        className="relative w-full max-w-sm rounded-xl bg-white p-8 shadow-lg"
      >
        <button
          type="button"
          aria-label="閉じる"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <Icon name="close" />
        </button>
        <div className="flex flex-col items-center gap-6 text-center">
          <h2 id="qr-title" className="text-2xl font-bold text-viewer-text">
            サーバーと接続
          </h2>
          <p className="text-sm text-gray-600">
            スマートフォンでQRコードを <br />
            スキャンして接続してください
          </p>
          <div className="h-64 w-64 flex items-center justify-center bg-white p-2 border border-gray-200 rounded-lg">
            {remoteUrl ? (
              <QRCodeSVG value={remoteUrl} size={240} level="H" marginSize={1} role="img" aria-label="Remote 画面への QR コード" />
            ) : (
              <p className="text-xs text-gray-400">QRコードを生成中...</p>
            )}
          </div>
          <div
            role="status"
            className={`flex w-full items-center justify-center rounded-lg p-2 text-sm font-medium ${s.box}`}
          >
            <span className={`mr-2 h-2.5 w-2.5 rounded-full ${s.dot}`} />
            <span>{s.text}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
