import { useEffect } from 'react'

// Safari などの接頭辞つきの API にも対応する
type FsDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }

export function isFullscreen(): boolean {
  const d = document as FsDocument
  return !!(d.fullscreenElement || d.webkitFullscreenElement)
}

// 全画面表示を始める。ブラウザの仕様で、クリックなど利用者の操作の中で呼ぶ必要がある。
export function requestFullscreen(element: HTMLElement): void {
  const el = element as FsElement
  const request = el.requestFullscreen
    ? () => el.requestFullscreen()
    : el.webkitRequestFullscreen
      ? () => el.webkitRequestFullscreen?.()
      : null
  if (!request) {
    alert('お使いのブラウザは全画面表示をサポートしていません。F11キーをお試しください。')
    return
  }
  try {
    const result = request()
    if (result instanceof Promise) result.catch((error) => console.error('Fullscreen request failed:', error))
  } catch (error) {
    console.error('Fullscreen request failed:', error)
  }
}

export function exitFullscreen(): void {
  if (!isFullscreen()) return
  const d = document as FsDocument
  const result = d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen?.()
  if (result instanceof Promise) result.catch((error) => console.error('Exit fullscreen failed:', error))
}

// 全画面表示が始まった・終わったときに呼ばれる
export function useFullscreenChange(onChange: (active: boolean) => void): void {
  useEffect(() => {
    const handler = () => onChange(isFullscreen())
    document.addEventListener('fullscreenchange', handler)
    document.addEventListener('webkitfullscreenchange', handler)
    return () => {
      document.removeEventListener('fullscreenchange', handler)
      document.removeEventListener('webkitfullscreenchange', handler)
    }
  }, [onChange])
}
