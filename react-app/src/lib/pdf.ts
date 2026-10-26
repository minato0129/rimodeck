import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type RenderTask,
} from 'pdfjs-dist/legacy/build/pdf.mjs'
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

export type PdfDoc = PDFDocumentProxy

// PDF を開く。destroy() で読み込みを中断・破棄できる。
export function openPdf(url: string): { promise: Promise<PdfDoc>; destroy: () => void } {
  const task = getDocument({ url, httpHeaders: authHeaders() })
  return { promise: task.promise, destroy: () => void task.destroy() }
}

export type RenderHandle = { cancel: () => void; finished: Promise<void> }

// 指定ページを、box に収まる最大の大きさ(縦横比を保つ)で canvas に描画する。
// pdf.js は同じ canvas への描画が重なるとエラーになるので、前の描画(after)が終わってから始める。
export function renderFitted(
  doc: PdfDoc,
  pageNum: number,
  canvas: HTMLCanvasElement,
  box: { width: number; height: number },
  after?: Promise<void>,
): RenderHandle {
  let cancelled = false
  let task: RenderTask | undefined

  const finished = (async () => {
    await after
    if (cancelled) return
    try {
      const page = await doc.getPage(pageNum)
      if (cancelled) return
      const base = page.getViewport({ scale: 1 })
      // 画面が横長なら高さに、縦長なら幅に合わせる
      const scale =
        box.width / box.height > base.width / base.height ? box.height / base.height : box.width / base.width
      const viewport = page.getViewport({ scale })
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      task = page.render({ canvas, canvasContext: ctx, viewport })
      await task.promise
    } catch (error) {
      if (!cancelled) console.error('Error rendering page:', error)
    }
  })()

  return {
    cancel: () => {
      cancelled = true
      task?.cancel()
    },
    finished,
  }
}
