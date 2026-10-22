import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { authHeaders } from './api'

// 最新版の pdf.js は比較的新しいブラウザの機能(Map.prototype.getOrInsertComputed など)を使うため、
// 古いブラウザでもサムネイルが描画されるよう、互換処理の入った legacy ビルドを使う。
// Worker は npm のパッケージから配信する(現行版は CDN)
GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// PDF の1ページ目を canvas いっぱいに(はみ出た分は中央で切って)描画する。
// 呼び出し側が signal で中断できる。
export async function renderThumbnail(
  canvas: HTMLCanvasElement,
  pdfUrl: string,
  signal: AbortSignal,
): Promise<void> {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const container = canvas.parentElement
  const width = container?.clientWidth || 200
  const height = container?.clientHeight || 150
  canvas.width = width
  canvas.height = height

  const loadingTask = getDocument({ url: pdfUrl, httpHeaders: authHeaders() })
  signal.addEventListener('abort', () => void loadingTask.destroy())

  try {
    const pdf = await loadingTask.promise
    const page = await pdf.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.max(width / base.width, height / base.height)
    const viewport = page.getViewport({ scale })
    const offsetX = (width - viewport.width) / 2
    const offsetY = (height - viewport.height) / 2
    await page.render({
      canvas,
      canvasContext: ctx,
      viewport,
      transform: [1, 0, 0, 1, offsetX, offsetY],
    }).promise
  } catch (error) {
    if (signal.aborted) return
    console.error(`Error rendering thumbnail for ${pdfUrl}:`, error)
    ctx.fillStyle = '#e5e7eb'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
}
