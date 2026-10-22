import Icon from './Icon'
import PdfThumbnail from './PdfThumbnail'
import { fileNameOf } from '../lib/api'

export type ViewMode = 'grid' | 'list'

type Props = {
  pdfUrl: string
  mode: ViewMode
  menuOpen: boolean
  onToggleMenu: () => void
  onOpen: () => void
  onDelete: () => void
}

// 現行版は表示のたびに乱数で「N週間前」を出していた。再描画でちらつかないよう、ファイル名から決まる値にしている。
// (更新日時はサーバーから取得していないため、あくまで仮の表示)
function placeholderWeeks(name: string): number {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return (h % 4) + 1
}

function DeleteMenu({ onDelete, className }: { onDelete: () => void; className: string }) {
  return (
    <div
      role="menu"
      className={`absolute mt-2 w-48 bg-white rounded-md shadow-lg py-1 ring-1 ring-black/5 z-10 ${className}`}
    >
      <button
        type="button"
        role="menuitem"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
      >
        <Icon name="delete" className="text-sm mr-2 align-middle text-red-500" />
        <span className="align-middle">ファイルを削除</span>
      </button>
    </div>
  )
}

export default function PdfCard({ pdfUrl, mode, menuOpen, onToggleMenu, onOpen, onDelete }: Props) {
  const fileName = fileNameOf(pdfUrl)
  const title = fileName.replace(/\.pdf$/i, '')
  const weeks = placeholderWeeks(fileName)

  const trigger = (extra: string) => (
    <button
      type="button"
      aria-label="メニュー"
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      onClick={(e) => {
        e.stopPropagation()
        onToggleMenu()
      }}
      className={`text-gray-400 hover:text-gray-600 rounded-full transition ${extra}`}
    >
      <Icon name="more_vert" className="text-base pointer-events-none" />
    </button>
  )

  if (mode === 'grid') {
    return (
      <div
        data-pdf-card
        onClick={onOpen}
        className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 relative cursor-pointer"
      >
        <div className="h-[150px] bg-gray-200 flex items-center justify-center rounded-t-xl overflow-hidden">
          <PdfThumbnail pdfUrl={pdfUrl} className="w-full h-full object-cover shadow-md" />
        </div>
        <div className="p-4">
          <div data-card-menu className="absolute top-2 right-2">
            {trigger('p-1 bg-white/70 hover:bg-white')}
            {menuOpen && <DeleteMenu onDelete={onDelete} className="right-0" />}
          </div>
          <p className="text-sm font-medium text-text-dark truncate">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{weeks}週間前</p>
        </div>
      </div>
    )
  }

  return (
    <div
      data-pdf-card
      onClick={onOpen}
      className="bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-300 relative cursor-pointer flex items-center p-3 gap-4"
    >
      <div className="w-20 h-14 bg-gray-100 shrink-0 rounded overflow-hidden flex items-center justify-center">
        <PdfThumbnail pdfUrl={pdfUrl} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-dark truncate">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">最終更新: {weeks}週間前</p>
      </div>
      <div data-card-menu>
        {trigger('p-2 hover:bg-gray-100')}
        {menuOpen && <DeleteMenu onDelete={onDelete} className="right-2" />}
      </div>
    </div>
  )
}
