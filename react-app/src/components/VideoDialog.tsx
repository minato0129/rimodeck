import { useEffect, useRef } from 'react'
import Icon from './Icon'
import { VIDEO_ACCEPT, type PageVideo } from '../lib/videos'

type Props = {
  page: number
  videos: PageVideo[]
  current: PageVideo | undefined
  busy: boolean
  error: string | null
  onUpload: (page: number, file: File) => void
  onRemove: (page: number) => void
  onGoTo: (page: number) => void
  onClose: () => void
}

// 表示中のページに動画を紐付ける・外すダイアログ。紐付けたページが表示されると、動画が自動で再生される
export default function VideoDialog({ page, videos, current, busy, error, onUpload, onRemove, onGoTo, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-title"
        className="relative w-full max-w-md rounded-xl bg-white p-8 shadow-lg"
      >
        <button
          type="button"
          aria-label="閉じる"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <Icon name="close" />
        </button>
        <div className="flex flex-col gap-4">
          <h2 id="video-title" className="text-center text-2xl font-bold text-viewer-text">
            ページの動画
          </h2>
          <p className="text-center text-sm text-gray-600">
            {page} ページに動画を紐付けると、このページが表示されたときに自動で再生されます(1ページに1本、mp4 / webm / mov、500MBまで)。
          </p>

          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-sm font-medium text-gray-700">{page} ページの動画</p>
            <p className="mt-1 break-all text-sm text-gray-600">{current ? current.name : 'まだありません'}</p>
            <div className="mt-3 flex gap-2">
              <input
                ref={inputRef}
                type="file"
                accept={VIDEO_ACCEPT}
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = '' // 同じファイルをもう一度選べるように
                  if (file) onUpload(page, file)
                }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="flex items-center rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                <Icon name={busy ? 'progress_activity' : 'cloud_upload'} className={`mr-1 text-lg ${busy ? 'animate-spin' : ''}`} />
                {busy ? 'アップロード中...' : current ? '差し替える' : '動画を選ぶ'}
              </button>
              {current && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRemove(page)}
                  className="flex items-center rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <Icon name="delete" className="mr-1 text-lg" />
                  外す
                </button>
              )}
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {videos.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">動画のあるページ</p>
              <ul className="max-h-40 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
                {videos.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => onGoTo(v.page)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <span className="shrink-0 font-medium text-gray-800">{v.page} ページ</span>
                      <span className="min-w-0 truncate text-gray-600">{v.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
