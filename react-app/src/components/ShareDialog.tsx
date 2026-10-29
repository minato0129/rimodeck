import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'
import Icon from './Icon'
import { watchUrl } from '../lib/share'
import type { SocketStatus } from '../lib/viewer'

type Props = {
  token: string | null
  audience: number
  canStart: boolean
  socketStatus: SocketStatus
  error: string | null
  onStart: () => void
  onStop: () => void
  onClose: () => void
}

// 傾聴者(会場の後ろの席の人など)が、自分のスマホでスライドを見るための共有ダイアログ
export default function ShareDialog({ token, audience, canStart, socketStatus, error, onStart, onStop, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const url = token ? watchUrl(token) : null

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // コピーできない環境では、表示した URL を手で選んでもらう
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
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
        <div className="flex flex-col items-center gap-5 text-center">
          <h2 id="share-title" className="text-2xl font-bold text-viewer-text">
            傾聴者に共有
          </h2>

          {url ? (
            <>
              <p className="text-sm text-gray-600">
                傾聴者のスマホでQRコードを読み取ると、
                <br />
                スライドが表示されます(ログイン不要)
              </p>
              <div className="flex h-64 w-64 items-center justify-center rounded-lg border border-gray-200 bg-white p-2">
                <QRCodeSVG value={url} size={240} level="H" marginSize={1} role="img" aria-label="傾聴者用の QR コード" />
              </div>
              <button
                type="button"
                onClick={copy}
                className="w-full break-all rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600 hover:bg-gray-200"
              >
                {copied ? 'コピーしました' : url}
              </button>
              <div
                role="status"
                className="flex w-full items-center justify-center rounded-lg bg-green-500/20 p-2 text-sm font-medium text-green-700"
              >
                <Icon name="groups" className="mr-2 text-xl" />
                <span>共有中: {audience}人が閲覧中</span>
              </div>
              <button
                type="button"
                onClick={onStop}
                className="w-full rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
              >
                共有を停止
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                共有を始めると、傾聴者用のQRコードが表示されます。
                <br />
                傾聴者のスマホには、あなたのページ移動に合わせてスライドが表示されます。
              </p>
              <button
                type="button"
                onClick={onStart}
                disabled={!canStart}
                className="w-full rounded-lg bg-primary-blue px-4 py-2 text-sm font-medium text-white hover:bg-primary-blue/80 disabled:opacity-50"
              >
                共有を開始
              </button>
              {!canStart && (
                <p role="status" className="text-xs text-gray-500">
                  {socketStatus === 'error' || socketStatus === 'closed'
                    ? 'サーバーとの接続(WebSocket)に失敗しました。Go サーバーが起動しているか確認して、画面を再読み込みしてください。'
                    : 'サーバーに接続しています...'}
                </p>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
