import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

type Props = {
  // そのページに紐付いた動画の URL(なければ null)
  src: string | null
  // 音を消して流すか。ブラウザは、音ありの自動再生を止めることがある(止められたときは、自動で音なしにして流す)
  muted: boolean
}

// ページに動画が紐付いていたら、そのページが表示されたときに、スライドの上に重ねて自動再生する。
// 終わる・閉じると、スライドに戻る(もう一度見たいときは「動画を再生」)。
export default function PageVideoLayer({ src, muted }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // 閉じた(または再生し終えた)動画の URL。ページを離れて動画のないページになったら忘れる(戻ったらまた流れる)
  const [dismissed, setDismissed] = useState<string | null>(null)
  if (src === null && dismissed !== null) setDismissed(null)

  const visible = src !== null && dismissed !== src

  useEffect(() => {
    const el = videoRef.current
    if (!visible || !el) return
    el.currentTime = 0
    el.muted = muted
    el.play().catch(() => {
      // 音ありの自動再生が止められたら、音なしで流す(音は、動画のコントロールから出せる)
      el.muted = true
      el.play().catch(() => {})
    })
  }, [visible, src, muted])

  if (src === null) return null

  if (!visible) {
    return (
      <button
        type="button"
        onClick={() => setDismissed(null)}
        className="absolute bottom-3 right-3 z-[5] flex items-center rounded-full bg-gray-900/80 px-4 py-2 text-sm font-medium text-white shadow hover:bg-gray-900"
      >
        <Icon name="play_circle" className="mr-1 text-lg" />
        動画を再生
      </button>
    )
  }

  return (
    <div className="absolute inset-0 z-[5] flex items-center justify-center bg-black">
      <video
        ref={videoRef}
        key={src}
        src={src}
        controls
        playsInline
        preload="auto"
        onEnded={() => setDismissed(src)}
        className="max-h-full max-w-full"
      />
      <button
        type="button"
        aria-label="動画を閉じる"
        title="動画を閉じる"
        onClick={() => setDismissed(src)}
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-900/70 text-white hover:bg-gray-900"
      >
        <Icon name="close" className="text-xl" />
      </button>
    </div>
  )
}
