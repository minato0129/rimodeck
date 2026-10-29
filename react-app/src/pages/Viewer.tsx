// 移植元: go-server/src/slide.html / assets/js/slide.js
// 移したもの: PDF の表示、ページ送り(キーボード・Remote)、ヘッダー、QR コードと WebSocket、スライドメモ、全画面、発表者モード(別ウィンドウ)
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import NotePanel from '../components/NotePanel'
import PresentationOverlay from '../components/PresentationOverlay'
import QrDialog from '../components/QrDialog'
import QuestionBoard from '../components/QuestionBoard'
import QuestionPanel from '../components/QuestionPanel'
import ShareDialog from '../components/ShareDialog'
import { fileNameOf } from '../lib/api'
import { requestFullscreen, useFullscreenChange } from '../lib/fullscreen'
import { useNote } from '../lib/notes'
import { startShare, stopShare } from '../lib/share'
import { useQuestions } from '../lib/questions'
import { openPdf, renderFitted, type PdfDoc, type RenderHandle } from '../lib/pdf'
import { getUsername } from '../lib/session'
import { useLogout } from '../lib/useLogout'
import { openPresenterWindow, usePageSync } from '../lib/sync'
import { useViewerSocket, type ViewerStatus } from '../lib/viewer'

export default function Viewer() {
  const [params] = useSearchParams()
  const username = getUsername()
  const pdfUrl = params.get('pdf')

  // 未ログインならログイン画面へ(現行版と同じ)
  if (!username) return <Navigate to="/login" replace />
  if (!pdfUrl) return <MissingPdf />
  // PDF や接続先の ID が変わったら、画面の状態を作り直す
  return (
    <Presentation
      key={pdfUrl}
      username={username}
      pdfUrl={pdfUrl}
      existingId={params.get('viewer_id')}
      presenter={params.get('presenter') === 'true'}
    />
  )
}

// PDF が指定されていないときは、案内を出して一覧に戻す(現行版と同じ)
function MissingPdf() {
  const navigate = useNavigate()
  const alerted = useRef(false)
  useEffect(() => {
    if (!alerted.current) {
      alerted.current = true
      alert('ファイルが指定されていません。開始画面に戻ります。')
    }
    navigate('/', { replace: true })
  }, [navigate])
  return null
}

type LoadState = 'loading' | 'ready' | 'error'

// 文字を入力する場所では、キー操作でページを送らない
function isTextEntry(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable]')
}

// ボタンやリンクの上では、Enter はそのボタンを押す操作として残す(矢印キーはページ送りに使える)
function isActivatable(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('button, a, summary')
}

type PresentationProps = { username: string; pdfUrl: string; existingId: string | null; presenter: boolean }

function Presentation({ username, pdfUrl, existingId, presenter }: PresentationProps) {
  const handleLogout = useLogout()
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [page, setPage] = useState(0)
  const [qrOpen, setQrOpen] = useState(false)
  // 傾聴者共有: token があれば共有中。共有ダイアログを閉じても共有は続く
  const [shareOpen, setShareOpen] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [audience, setAudience] = useState(0)
  // 傾聴者からの質問(発表者モードの別ウィンドウでは扱わない)
  const [questionsOpen, setQuestionsOpen] = useState(false)
  const questions = useQuestions(pdfUrl)
  // 発表者モードのウィンドウは、開いたらすぐ「全画面にする」確認を出す
  const [overlayOpen, setOverlayOpen] = useState(presenter)
  const mainRef = useRef<HTMLElement>(null)
  // スライドと質問の一覧を含む領域(発表者モードの別ウィンドウは、質問も見えるようこちらを全画面にする)
  const bodyRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lastRender = useRef<RenderHandle | null>(null)
  // 他の Viewer から受け取ったページに移ったときは、同じページをもう一度知らせない(ループ防止)
  const skipBroadcastFor = useRef<number | null>(null)
  // 別ウィンドウから届いたページに移ったときも同じ(ループ防止)。PDF の読み込み前に届いたページは、読み込み後に使う
  const skipSyncFor = useRef<number | null>(null)
  const pendingSync = useRef<number | null>(null)

  const fileName = fileNameOf(pdfUrl)
  const total = doc?.numPages ?? 0

  // 最新の値を、WebSocket のコールバックから読むための ref
  const latest = useRef({ page, total })
  useEffect(() => {
    latest.current = { page, total }
  })

  const goTo = useCallback((n: number) => {
    const { total } = latest.current
    if (n < 1 || n > total) return
    setPage(n)
  }, [])
  const next = useCallback(() => goTo(latest.current.page + 1), [goTo])
  const prev = useCallback(() => goTo(latest.current.page - 1), [goTo])

  // メモを保存したら、Remote などにも知らせる(sendStatus は、この下の WebSocket のフックが返す)
  const sendRef = useRef<(s: ViewerStatus) => void>(() => {})
  // 知らせるのは、保存したページではなく「いま表示中のページ」(保存を待つ間にページが変わっても、古いページを知らせない)
  // 発表者モードの別ウィンドウ(傾聴者に見せる画面)には、メモを出さない
  const note = useNote(pdfUrl, page, () => sendRef.current({ page_index: latest.current.page, pdf_path: pdfUrl }), !presenter)

  const syncPage = usePageSync(
    presenter,
    () => latest.current.page,
    (n) => {
      const { page, total } = latest.current
      if (total === 0) {
        pendingSync.current = n
      } else if (n >= 1 && n <= total && n !== page) {
        skipSyncFor.current = n
        setPage(n)
      }
    },
  )

  const { viewerId, status, sendStatus } = useViewerSocket(
    existingId,
    {
      onRemoteCommand: (command, api) => {
        switch (command) {
          case 'next':
            next()
            break
          case 'prev':
            prev()
            break
          case 'ping':
            // Remote に、いまのページを知らせる
            api.sendStatus({ page_index: latest.current.page, pdf_path: pdfUrl })
            break
          case 'note_updated':
            note.reload()
            break
          default:
            console.log('Unknown remote command:', command)
        }
      },
      onAudienceCount: setAudience,
      onQuestion: questions.addQuestion,
      onPeerStatus: (peer) => {
        if (peer.page_index !== undefined && peer.page_index !== latest.current.page) {
          skipBroadcastFor.current = peer.page_index
          goTo(peer.page_index)
        }
      },
    },
    !presenter, // 発表者モードのウィンドウは WebSocket につながない(ページはメインから受け取る)
  )

  useEffect(() => {
    sendRef.current = sendStatus
  }, [sendStatus])

  // 全画面が終わったら、確認のオーバーレイも閉じる(ページの描き直しは、表示領域の大きさの監視が行う)
  useFullscreenChange(
    useCallback((active: boolean) => {
      if (!active) setOverlayOpen(false)
    }, []),
  )

  const startFullscreen = useCallback(() => {
    const target = presenter ? bodyRef.current : mainRef.current
    if (target) requestFullscreen(target)
    setOverlayOpen(false)
  }, [presenter])
  const closeOverlay = useCallback(() => setOverlayOpen(false), [])
  const startPresenter = useCallback(() => {
    openPresenterWindow()
    setOverlayOpen(false)
  }, [])

  // PDF を読み込む
  useEffect(() => {
    let cancelled = false
    const task = openPdf(pdfUrl)
    task.promise
      .then((d) => {
        if (cancelled) return // 破棄は cleanup の task.destroy() が行う
        setDoc(d)
        setLoadState('ready')
        if (d.numPages > 0) {
          // 発表者モードのウィンドウは、メインから届いたページで始める。それを、メインへ送り返さない
          const first = Math.min(Math.max(pendingSync.current ?? 1, 1), d.numPages)
          if (presenter) skipSyncFor.current = first
          setPage(first)
        }
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
  }, [pdfUrl, presenter])

  // ページを描く。表示領域の大きさが変わったとき(ウィンドウのサイズ変更など)も描き直す。
  useEffect(() => {
    const main = mainRef.current
    const canvas = canvasRef.current
    if (!doc || page < 1 || !main || !canvas) return

    let frame = 0
    const draw = () => {
      lastRender.current?.cancel()
      const handle = renderFitted(
        doc,
        page,
        canvas,
        { width: main.clientWidth, height: main.clientHeight },
        lastRender.current?.finished,
      )
      lastRender.current = handle
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

  // ページが変わったら Remote などに知らせる
  useEffect(() => {
    if (page < 1) return
    if (skipBroadcastFor.current === page) {
      skipBroadcastFor.current = null
      return
    }
    sendStatus({ page_index: page, pdf_path: pdfUrl })
  }, [page, pdfUrl, sendStatus])

  // ページが変わったら、別ウィンドウ(メインと発表者モード)にも知らせる
  useEffect(() => {
    if (page < 1) return
    if (skipSyncFor.current === page) {
      skipSyncFor.current = null
      return
    }
    syncPage(page)
  }, [page, syncPage])

  // キーボード操作
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || isTextEntry(e.target)) return
      if (e.key === 'Enter' && isActivatable(e.target)) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        prev()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [next, prev])

  const closeQr = useCallback(() => setQrOpen(false), [])
  const closeShare = useCallback(() => setShareOpen(false), [])
  const handleStartShare = useCallback(async () => {
    if (!viewerId) return
    setShareError(null)
    try {
      setShareToken(await startShare(pdfUrl, viewerId, latest.current.page))
    } catch (e) {
      console.error('Failed to start share:', e)
      setShareError('共有を始められませんでした。')
    }
  }, [viewerId, pdfUrl])
  const handleStopShare = useCallback(async () => {
    setShareError(null)
    try {
      await stopShare()
      setShareToken(null)
      setAudience(0)
    } catch (e) {
      console.error('Failed to stop share:', e)
      setShareError('共有を止められませんでした。')
    }
  }, [])
  const { latest: latestQuestion, setPanelOpen } = questions
  const toast = latestQuestion ? `新しい質問があります (${latestQuestion.page} ページ)` : null
  const openQuestions = useCallback(() => {
    setQuestionsOpen(true)
    setPanelOpen(true)
  }, [setPanelOpen])
  const closeQuestions = useCallback(() => {
    setQuestionsOpen(false)
    setPanelOpen(false)
  }, [setPanelOpen])

  return (
    <div className="bg-viewer-bg font-sans flex h-screen flex-col overflow-hidden text-viewer-text">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <img src="/logos/logo-light.svg" alt="rimodeck" className="h-6" />
          {!presenter && <span className="text-xs text-gray-500 ml-1">{username}</span>}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-base font-medium text-gray-700" aria-live="polite">
            ページ <span>{page}</span> / <span>{total}</span>
          </span>
          {/* 発表者モードの別ウィンドウは、傾聴者みんなが見る画面なので、操作のボタンは出さない */}
          {!presenter && (
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-red-500 transition duration-150"
            >
              ログアウト
            </button>
          )}
          {!presenter && (
            <Link
              to="/"
              className="flex items-center justify-center rounded-lg bg-gray-500 px-3 py-2 text-white transition-colors hover:bg-gray-700"
            >
              <Icon name="folder_open" className="text-xl" />
              <span className="ml-2 hidden text-sm font-medium sm:inline">ファイル選択に戻る</span>
            </Link>
          )}
          {!presenter && (
            <button
              type="button"
              onClick={() => setOverlayOpen(true)}
              className="flex items-center justify-center rounded-lg bg-gray-800 px-3 py-2 text-white transition-colors hover:bg-gray-700"
            >
              <Icon name="slideshow" className="text-xl" />
              <span className="ml-2 hidden text-sm font-medium sm:inline">プレゼンテーション</span>
            </button>
          )}
          {!presenter && (
            <button
              type="button"
              onClick={openQuestions}
              title="傾聴者からの質問"
              className="relative flex items-center justify-center rounded-lg bg-gray-800 px-3 py-2 text-white transition-colors hover:bg-gray-700"
            >
              <Icon name="forum" className="text-xl" />
              <span className="ml-2 hidden whitespace-nowrap text-sm font-medium xl:inline">質問</span>
              {questions.unseen > 0 && (
                <span
                  aria-label={`新着の質問 ${questions.unseen} 件`}
                  className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold"
                >
                  {questions.unseen}
                </span>
              )}
            </button>
          )}
          {!presenter && (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              title="傾聴者に共有"
              className={`flex items-center justify-center rounded-lg px-3 py-2 text-white transition-colors ${
                shareToken ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              <Icon name="groups" className="text-xl" />
              <span className="ml-2 hidden whitespace-nowrap text-sm font-medium xl:inline">
                {shareToken ? `共有中 (${audience})` : '傾聴者に共有'}
              </span>
            </button>
          )}
          {!presenter && (
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              className="flex items-center justify-center rounded-lg bg-primary-blue px-3 py-2 text-white transition-colors hover:bg-primary-blue/80"
            >
              <Icon name="qr_code_scanner" className="text-xl" />
              <span className="ml-2 hidden text-sm font-medium sm:inline">リモートで操作</span>
            </button>
          )}
        </div>
      </header>

      <div ref={bodyRef} className="flex flex-1 min-h-0 bg-viewer-bg">
        <main
          ref={mainRef}
          className="relative flex min-h-0 w-full flex-col overflow-hidden rounded-lg bg-gray-100 shadow-xl lg:min-h-full"
        >
          <div className="flex flex-1 min-h-0 w-full items-center justify-center overflow-hidden p-0">
            <canvas ref={canvasRef} className="max-h-full max-w-full h-auto w-auto shadow-md" />
            {loadState !== 'ready' && (
              <div role={loadState === 'error' ? 'alert' : 'status'} className="absolute text-xl font-bold">
                {loadState === 'error' ? `${fileName} の読み込みに失敗しました。` : `${fileName} を読み込み中...`}
              </div>
            )}
          </div>
        </main>

        {presenter ? (
          <QuestionBoard
            questions={questions.questions}
            currentPage={page}
            highlightId={questions.latest?.id ?? null}
            onGoTo={goTo}
          />
        ) : (
          <NotePanel text={note.text} loading={note.loading} failed={note.failed} onChange={note.change} />
        )}
      </div>

      {overlayOpen && (
        <PresentationOverlay
          onFullscreen={startFullscreen}
          onCancel={closeOverlay}
          onPresenter={presenter ? undefined : startPresenter}
          presenterWindow={presenter}
        />
      )}
      {toast && !questionsOpen && !presenter && (
        <button
          type="button"
          role="status"
          onClick={openQuestions}
          className="fixed bottom-6 right-6 z-40 rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </button>
      )}
      {questionsOpen && !presenter && (
        <QuestionPanel
          questions={questions.questions}
          currentPage={page}
          failed={questions.failed}
          onGoTo={goTo}
          onToggleAnswered={questions.toggleAnswered}
          onDelete={questions.remove}
          onClose={closeQuestions}
        />
      )}
      {shareOpen && !presenter && (
        <ShareDialog
          token={shareToken}
          audience={audience}
          canStart={viewerId !== null}
          socketStatus={status}
          error={shareError}
          onStart={handleStartShare}
          onStop={handleStopShare}
          onClose={closeShare}
        />
      )}
      {qrOpen && !presenter && <QrDialog viewerId={viewerId} username={username} status={status} onClose={closeQr} />}
    </div>
  )
}
