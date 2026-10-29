import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, apiFetch } from './api'

// 傾聴者から届いた質問
export type Question = {
  id: number
  page: number // どのスライドへの質問か
  content: string
  answered: boolean
  created_at: string
}

export const MAX_QUESTION_LENGTH = 200

// 同じブラウザの別ウィンドウ(メインと、プロジェクターに映す発表者モード)で、質問の変更をそろえる
const CHANNEL = 'rimodeck_questions'

type SyncOp =
  | { type: 'add'; q: Question }
  | { type: 'answered'; id: number; answered: boolean }
  | { type: 'delete'; id: number }
type SyncMessage = { pdf: string; op: SyncOp }

async function fetchQuestions(pdfPath: string, signal: AbortSignal): Promise<Question[]> {
  const response = await apiFetch(`/questions?pdf_path=${encodeURIComponent(pdfPath)}`, { signal })
  if (!response.ok) throw new ApiError(response.status, `HTTP error! status: ${response.status}`)
  return (await response.json()) ?? []
}

async function post(path: string, body: unknown): Promise<void> {
  const response = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new ApiError(response.status, `HTTP error! status: ${response.status}`)
}

// 発表者側: この PDF への質問の一覧。新着は addQuestion で足す(WebSocket から届いたもの)。
// - 届いたとき、画面を見ていなかった質問の数を unseen に数える(パネルを開いたら markSeen で 0 に戻す)
export function useQuestions(pdfPath: string, enabled = true) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [failed, setFailed] = useState(false)
  const [unseen, setUnseen] = useState(0)
  const [latest, setLatest] = useState<Question | null>(null) // 直近に届いた質問(通知の表示用。5秒で消える)
  const panelOpen = useRef(false)
  const latestTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(latestTimer.current), [])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    fetchQuestions(pdfPath, controller.signal)
      .then((list) => {
        setFailed(false)
        // 読み込み中に WebSocket で届いた質問と、重ならないようにまとめる
        setQuestions((prev) => {
          const byId = new Map(list.map((q) => [q.id, q]))
          for (const q of prev) if (!byId.has(q.id)) byId.set(q.id, q)
          return sortQuestions([...byId.values()])
        })
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        console.error('Failed to load questions:', error)
        setFailed(true)
      })
    return () => controller.abort()
  }, [pdfPath, enabled])

  // 質問が届いたときの、この画面での反映(通知の表示・件数)
  const applyAdd = useCallback((q: Question) => {
    setQuestions((prev) => (prev.some((x) => x.id === q.id) ? prev : sortQuestions([...prev, q])))
    if (!panelOpen.current) setUnseen((n) => n + 1)
    // 通知は、しばらくしたら自動で消す
    setLatest(q)
    window.clearTimeout(latestTimer.current)
    latestTimer.current = window.setTimeout(() => setLatest(null), 5000)
  }, [])
  const applyAnswered = useCallback((id: number, answered: boolean) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, answered } : q)))
  }, [])
  const applyDelete = useCallback((id: number) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }, [])

  // 別ウィンドウへの知らせ。別ウィンドウからの知らせは、この画面にだけ反映する(送り返さない)
  const channelRef = useRef<BroadcastChannel | null>(null)
  useEffect(() => {
    if (!enabled || typeof BroadcastChannel === 'undefined') return // 古いブラウザでは、同期なしで動かす
    const channel = new BroadcastChannel(CHANNEL)
    channelRef.current = channel
    channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      const { pdf, op } = event.data
      if (pdf !== pdfPath) return
      if (op.type === 'add') applyAdd(op.q)
      else if (op.type === 'answered') applyAnswered(op.id, op.answered)
      else applyDelete(op.id)
    }
    return () => {
      channel.close()
      channelRef.current = null
    }
  }, [pdfPath, enabled, applyAdd, applyAnswered, applyDelete])
  const broadcast = useCallback(
    (op: SyncOp) => channelRef.current?.postMessage({ pdf: pdfPath, op } satisfies SyncMessage),
    [pdfPath],
  )

  // WebSocket で届いた新着(メインの画面だけが受け取る)
  const addQuestion = useCallback(
    (q: Question) => {
      applyAdd(q)
      broadcast({ type: 'add', q })
    },
    [applyAdd, broadcast],
  )

  const setPanelOpen = useCallback((open: boolean) => {
    panelOpen.current = open
    if (open) {
      setUnseen(0)
      setLatest(null)
    }
  }, [])

  const toggleAnswered = useCallback(
    async (id: number, answered: boolean) => {
      applyAnswered(id, answered)
      try {
        await post('/question/answered', { id, answered })
        broadcast({ type: 'answered', id, answered })
      } catch (error) {
        console.error('Failed to update question:', error)
        applyAnswered(id, !answered)
      }
    },
    [applyAnswered, broadcast],
  )

  const remove = useCallback(
    async (id: number) => {
      try {
        await post('/question/delete', { id })
      } catch (error) {
        // すでに消えている(404)ときも、一覧からは外す
        if (!(error instanceof ApiError && error.status === 404)) {
          console.error('Failed to delete question:', error)
          return
        }
      }
      applyDelete(id)
      broadcast({ type: 'delete', id })
    },
    [applyDelete, broadcast],
  )

  return { questions, failed, unseen, latest, addQuestion, setPanelOpen, toggleAnswered, remove }
}

// ページ順、同じページなら届いた順
function sortQuestions(list: Question[]): Question[] {
  return [...list].sort((a, b) => a.page - b.page || a.id - b.id)
}

// 傾聴者側: 質問を送る(ログイン不要。共有リンクのトークンが鍵)。失敗したら、理由の文章を持つ Error を投げる
export async function sendQuestion(token: string, page: number, content: string): Promise<void> {
  const response = await fetch(`/shared/${encodeURIComponent(token)}/question`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page, content }),
  })
  if (response.ok) return
  let message = '質問を送れませんでした。'
  try {
    const body: { error?: string } = await response.json()
    if (body.error) message = body.error
  } catch {
    // サーバーから理由が返らないときは、上の文章を使う
  }
  throw new Error(message)
}
