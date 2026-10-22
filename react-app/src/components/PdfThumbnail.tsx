import { useEffect, useRef } from 'react'

export default function PdfThumbnail({ pdfUrl, className }: { pdfUrl: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const controller = new AbortController()
    // pdf.js は大きいので、サムネイルを描くときに初めて読み込む(ログイン画面などでは読み込まない)
    void import('../lib/pdf').then(({ renderThumbnail }) => {
      if (!controller.signal.aborted) return renderThumbnail(canvas, pdfUrl, controller.signal)
    })
    return () => controller.abort()
  }, [pdfUrl])

  return <canvas ref={canvasRef} className={className} />
}
