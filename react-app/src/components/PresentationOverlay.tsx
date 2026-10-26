import { useEffect, useRef } from 'react'
import Icon from './Icon'

type Props = {
  onFullscreen: () => void
  onCancel: () => void
  // 発表者モードで開く(別ウィンドウ)。発表者モードのウィンドウ自身では渡さない
  onPresenter?: () => void
  // 発表者モードのウィンドウ自身。全画面にするだけの確認で、キャンセルはない
  presenterWindow?: boolean
}

// 全画面表示は、利用者のクリックがないと始められない。スマホから開始を頼まれたときは、
// このオーバーレイを出して、PC 側でクリックしてもらう。
export default function PresentationOverlay({ onFullscreen, onCancel, onPresenter, presenterWindow = false }: Props) {
  const startRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    startRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !presenterWindow) onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel, presenterWindow])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="presentation-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 text-white"
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-gray-900/50 p-10 text-center shadow-2xl backdrop-blur-md">
        <Icon name="play_circle" className="mb-6 text-7xl text-primary-blue" />
        <h2 id="presentation-title" className="mb-8 text-2xl font-bold">
          {presenterWindow ? '発表者モードを全画面で開始' : 'プレゼンテーションを開始'}
        </h2>
        <div className="grid grid-cols-1 gap-4">
          <button
            ref={startRef}
            type="button"
            onClick={onFullscreen}
            className="flex transform items-center justify-center gap-3 rounded-xl bg-primary-blue px-6 py-4 font-bold text-white transition-all hover:scale-105 hover:bg-primary-blue/80"
          >
            <Icon name="fullscreen" />
            {presenterWindow ? 'クリックして全画面を開始' : 'この画面で全画面表示'}
          </button>
          {onPresenter && (
            <button
              type="button"
              onClick={onPresenter}
              className="flex transform items-center justify-center gap-3 rounded-xl border border-white/30 bg-white/10 px-6 py-4 font-bold text-white transition-all hover:scale-105 hover:bg-white/20"
            >
              <Icon name="present_to_all" />
              発表者モード(別ウィンドウ)
            </button>
          )}
        </div>
        {!presenterWindow && (
          <button type="button" onClick={onCancel} className="mt-8 text-sm text-gray-400 transition-colors hover:text-white">
            キャンセル
          </button>
        )}
      </div>
    </div>
  )
}
