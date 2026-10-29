// 傾聴者用の画面(ログイン不要)。発表者のQRコードから開く。
// - 追従モード(初期状態): 発表者のページ移動に合わせて、この画面も動く
// - 自分で動かすモード: 前後のボタン・スワイプで動かすと切り替わる。「発表者に追従」で戻る
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { openPdf, renderFitted, type PdfDoc, type RenderHandle } from '../lib/pdf'
import { useWatchSocket } from '../lib/watch'

type LoadState = 'loading' | 'ready' | 'error'

const SWIPE_PX = 50

export default function Watch() {
  const { token } = useParams()
  if (!token) return <Message text="共有リンクが正しくありません。" />
  return <Watching token={token} />
}

function Message({ text }: { text: string }) {
  return (
    <div className="bg-viewer-bg font-sans flex h-dvh items-center justify-center p-6 text-center text-lg font-bold text-viewer-text">
      {text}
    </div>
  )
}

function Watching({ token }: { token: string }) {
  const { serverPage, status } = useWatchSocket(token)
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  // null のときは追従モード。数字のときは自分で動かしているページ
  const [manualPage, setManualPage] = useState<number | null>(null)
  const mainRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lastRender = useRef<RenderHandle | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const total = doc?.numPages ?? 0
  const clamp = (n: number) => Math.min(Math.max(n, 1), Math.max(total, 1))
  const following = manualPage === null
  const page = serverPage === null ? 0 : clamp(manualPage ?? serverPage)

  // PDF を読み込む
  useEffect(() => {
    let cancelled = false
    const task = openPdf(`/shared/${encodeURIComponent(token)}/pdf`)
    task.promise
      .then((d) => {
        if (cancelled) return
        setDoc(d)
        setLoadState('ready')
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Error loading PDF:', error)
        setLoadState('error')
      })
    return () => {
      cancelled = true
      task.destroy()
    }
  }, [token])

  // ページを描く。画面の大きさが変わったとき(向きの変更など)も描き直す
  useEffect(() => {
    const main = mainRef.current
    const canvas = canvasRef.current
    if (!doc || page < 1 || !main || !canvas) return

    let frame = 0
    const draw = () => {
      lastRender.current?.cancel()
      lastRender.current = renderFitted(
        doc,
        page,
        canvas,
        { width: main.clientWidth, height: main.clientHeight },
        lastRender.current?.finished,
      )
    }
    draw()

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(draw)
    })
    observer.observe(main)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      lastRender.current?.cancel()
    }
  }, [doc, page])

  // 自分でページを動かす。発表者と同じページに着いたら、追従モードに戻る
  const move = useCallback(
    (delta: number) => {
      if (page < 1) return
      const target = clamp(page + delta)
      if (target === page) return
      setManualPage(target === serverPage ? null : target)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, serverPage, total],
  )

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStart.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    // 横方向にはっきり動かしたときだけ、ページを送る(縦のスクロールや、タップは無視)
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1)
  }

  if (status === 'ended') return <Message text="共有は終了しました。または、リンクが無効です。" />

  return (
    <div className="bg-viewer-bg font-sans flex h-dvh flex-col overflow-hidden text-viewer-text">
      {status !== 'live' && (
        <div role="status" className="shrink-0 bg-yellow-500/20 p-1 text-center text-xs font-medium text-yellow-700">
          {status === 'reconnecting' ? '接続が切れました。再接続しています...' : '接続中...'}
        </div>
      )}

      <main
        ref={mainRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-gray-100"
      >
        <canvas ref={canvasRef} className="h-auto max-h-full w-auto max-w-full shadow-md" />
        {(loadState !== 'ready' || page < 1) && (
          <div role={loadState === 'error' ? 'alert' : 'status'} className="absolute px-4 text-center text-lg font-bold">
            {loadState === 'error' ? 'スライドの読み込みに失敗しました。' : '読み込み中...'}
          </div>
        )}
      </main>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-200 bg-white p-2">
        <button
          type="button"
          aria-label="前のページ"
          onClick={() => move(-1)}
          disabled={page <= 1}
          className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-800 text-white disabled:opacity-30"
        >
          <Icon name="chevron_left" className="text-3xl" />
        </button>

        <div className="flex min-w-0 flex-col items-center">
          <span className="text-base font-medium text-gray-700" aria-live="polite">
            {page} / {total}
          </span>
          {following ? (
            <span className="text-xs text-green-700">発表者に追従中</span>
          ) : (
            <button
              type="button"
              onClick={() => setManualPage(null)}
              className="mt-1 flex items-center rounded-full bg-primary-blue px-3 py-1 text-xs font-medium text-white"
            >
              <Icon name="sync" className="mr-1 text-base" />
              発表者に追従
            </button>
          )}
        </div>

        <button
          type="button"
          aria-label="次のページ"
          onClick={() => move(1)}
          disabled={page < 1 || page >= total}
          className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-800 text-white disabled:opacity-30"
        >
          <Icon name="chevron_right" className="text-3xl" />
        </button>
      </footer>
    </div>
  )
}
