// 移植元: go-server/src/index.html / assets/js/index.js
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import PdfCard, { type ViewMode } from '../components/PdfCard'
import { ApiError, deletePdf, fetchPdfs, fileNameOf, logoutRequest, uploadPdf } from '../lib/api'
import { clearUsername, getUsername } from '../lib/session'

type LoadState = 'loading' | 'ready' | 'error'

export default function Index() {
  const username = getUsername()
  // 未ログインならログイン画面へ(現行版と同じ)
  if (!username) return <Navigate to="/login" replace />
  return <Dashboard username={username} />
}

function Dashboard({ username }: { username: string }) {
  const navigate = useNavigate()
  const [pdfs, setPdfs] = useState<string[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<ViewMode>('grid')
  const [uploading, setUploading] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  // 取得して結果を反映する(アップロード・削除のあとの再読み込み用)
  const fetchAndApply = useCallback(async () => {
    try {
      setPdfs(await fetchPdfs())
      setLoadState('ready')
    } catch (error) {
      console.error('Failed to fetch PDF list:', error)
      setPdfs([])
      setLoadState('error')
    }
  }, [])

  // 再読み込み。現行版と同じく、読み込み中の表示を出す
  const reload = useCallback(() => {
    setLoadState('loading')
    return fetchAndApply()
  }, [fetchAndApply])

  // 最初の読み込み。画面を離れたあとに結果が返ってきても反映しない。
  useEffect(() => {
    let cancelled = false
    fetchPdfs()
      .then((list) => {
        if (cancelled) return
        setPdfs(list)
        setLoadState('ready')
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Failed to fetch PDF list:', error)
        setPdfs([])
        setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // メニューの外側を押したら閉じる。Esc でも閉じる。
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Element
      if (!profileRef.current?.contains(target)) setProfileOpen(false)
      if (!target.closest('[data-card-menu]')) setOpenMenu(null)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setProfileOpen(false)
        setOpenMenu(null)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const visible = useMemo(() => {
    const q = query.toLowerCase()
    return pdfs.filter((url) => fileNameOf(url).toLowerCase().includes(q))
  }, [pdfs, query])

  async function handleLogout() {
    try {
      await logoutRequest()
    } catch (error) {
      console.error('Logout request failed:', error)
    }
    clearUsername()
    navigate('/login')
  }

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await uploadPdf(file)
      void reload()
    } catch (error) {
      console.error('Upload failed:', error)
      alert(
        error instanceof ApiError
          ? `アップロード失敗: ${error.message}`
          : 'ネットワークエラーによりアップロードに失敗しました。',
      )
    } finally {
      setUploading(false)
      input.value = '' // 同じファイルをもう一度選べるようにする
    }
  }

  async function handleDelete(pdfUrl: string) {
    setOpenMenu(null)
    if (!confirm(`「${fileNameOf(pdfUrl)}」を本当に削除しますか？`)) return
    try {
      await deletePdf(pdfUrl)
      void reload()
    } catch (error) {
      console.error('Delete failed:', error)
      alert(
        error instanceof ApiError
          ? `削除失敗: ${error.message}`
          : 'ネットワークエラーにより削除に失敗しました。',
      )
    }
  }

  const containerClass =
    mode === 'grid'
      ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6'
      : 'flex flex-col gap-3 max-w-4xl mx-auto'

  return (
    <div className="bg-bg-light font-sans min-h-screen">
      <header className="bg-white shadow-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <img src="/logos/logo-light.svg" alt="rimodeck" className="h-8" />
          <div className="flex items-center space-x-4">
            <input
              type="file"
              id="pdf-upload-input"
              accept="application/pdf"
              className="peer sr-only"
              disabled={uploading}
              onChange={handleUpload}
            />
            <label
              htmlFor="pdf-upload-input"
              className={`flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg transition duration-150 cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-primary-blue ${
                uploading ? 'bg-gray-500' : 'bg-primary-blue hover:bg-blue-700'
              }`}
            >
              <Icon name={uploading ? 'progress_activity' : 'cloud_upload'} className={`text-base mr-1 ${uploading ? 'animate-spin' : ''}`} />
              {uploading ? 'アップロード中...' : 'プレゼンテーションをアップロード'}
            </label>

            <div ref={profileRef} className="relative">
              <button
                type="button"
                aria-label="プロフィール"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((v) => !v)}
                className="h-10 w-10 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-100 transition duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue border border-gray-200"
              >
                <Icon name="person" />
              </button>
              {profileOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl py-2 ring-1 ring-black/5 z-50"
                >
                  <div className="px-4 py-2 border-b border-gray-100 mb-1">
                    <p className="text-xs text-gray-500">ログイン中</p>
                    <p className="text-sm font-bold text-gray-800 truncate">{username} さん</p>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition duration-150 flex items-center"
                  >
                    <Icon name="logout" className="text-sm mr-2" />
                    ログアウト
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-text-dark">マイプレゼンテーション</h1>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="検索..."
                aria-label="検索"
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-blue focus:border-primary-blue w-64 text-sm"
              />
              <Icon name="search" className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
            </div>
            <div className="flex border border-gray-300 rounded-lg overflow-hidden bg-white">
              {(
                [
                  ['grid', 'grid_view', 'グリッド表示'],
                  ['list', 'view_list', 'リスト表示'],
                ] as const
              ).map(([value, icon, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-label={label}
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                  className={`p-2 transition-colors hover:bg-gray-200 ${
                    mode === value ? 'bg-gray-100 text-primary-blue' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <Icon name={icon} className="text-lg" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {loadState === 'loading' && (
          <div className="text-center py-10 text-gray-500">
            <p className="mb-2">
              <Icon name="progress_activity" className="animate-spin text-xl" />
            </p>
            <p>ファイル一覧を読み込み中...</p>
          </div>
        )}

        {loadState === 'error' && (
          <p role="alert" className="mt-8 text-sm text-red-500">
            PDFファイルをアップロードしてください
          </p>
        )}

        {loadState === 'ready' &&
          (visible.length === 0 ? (
            <div className="text-center py-10 text-gray-500">PDFファイルが見つかりません。</div>
          ) : (
            <div className={containerClass}>
              {visible.map((pdfUrl) => (
                <PdfCard
                  key={pdfUrl}
                  pdfUrl={pdfUrl}
                  mode={mode}
                  menuOpen={openMenu === pdfUrl}
                  onToggleMenu={() => setOpenMenu((cur) => (cur === pdfUrl ? null : pdfUrl))}
                  onOpen={() => navigate(`/viewer?pdf=${encodeURIComponent(pdfUrl)}`)}
                  onDelete={() => handleDelete(pdfUrl)}
                />
              ))}
            </div>
          ))}
      </main>
    </div>
  )
}
