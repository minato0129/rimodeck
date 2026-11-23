// スマホのリモート画面の編集モード。ボタンの追加・削除・並べ替え・大きさ・色を決める。
import Icon from './Icon'
import {
  BUTTONS,
  BUTTON_IDS,
  COLORS,
  LEVEL_NAMES,
  newButton,
  type ButtonColor,
  type ButtonWidth,
  type Level,
  type LayoutButton,
  type RemoteLayout,
} from '../lib/remoteLayout'

type Props = {
  draft: RemoteLayout
  onChange: (layout: RemoteLayout) => void
  onSave: () => void
  onCancel: () => void
  onReset: () => void
  saving: boolean
  error: string | null
}

const LEVELS: Level[] = ['s', 'm', 'l']
const WIDTHS: [ButtonWidth, string][] = [
  ['half', '半分'],
  ['full', '全幅'],
]

export default function RemoteLayoutEditor({ draft, onChange, onSave, onCancel, onReset, saving, error }: Props) {
  const buttons = draft.buttons
  const unused = BUTTON_IDS.filter((id) => !buttons.some((b) => b.id === id))

  function update(index: number, patch: Partial<LayoutButton>) {
    onChange({ buttons: buttons.map((b, i) => (i === index ? { ...b, ...patch } : b)) })
  }
  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= buttons.length) return
    const next = [...buttons]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange({ buttons: next })
  }
  function remove(index: number) {
    onChange({ buttons: buttons.filter((_, i) => i !== index) })
  }

  return (
    <div className="flex grow flex-col gap-3 p-4 pt-2">
      <p className="text-sm text-gray-600">
        ボタンの並びを決めます。上から順に、半分幅のボタンは 2 つずつ横に並びます。
      </p>

      {buttons.length === 0 && (
        <p className="rounded-[0.75rem] bg-yellow-500/20 p-3 text-sm text-yellow-700">
          ボタンがありません。下から追加してください。
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {buttons.map((button, index) => (
          <li key={button.id} className="rounded-[1rem] bg-white p-3 shadow">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-bold text-gray-800">
                <Icon name={BUTTONS[button.id].icon} className="text-2xl text-gray-500" />
                {BUTTONS[button.id].label}
              </span>
              <span className="flex items-center gap-1">
                <IconButton label="上へ" icon="arrow_upward" disabled={index === 0} onClick={() => move(index, -1)} />
                <IconButton
                  label="下へ"
                  icon="arrow_downward"
                  disabled={index === buttons.length - 1}
                  onClick={() => move(index, 1)}
                />
                <IconButton label="削除" icon="delete" danger onClick={() => remove(index)} />
              </span>
            </div>

            <Row title="幅">
              {WIDTHS.map(([value, name]) => (
                <Choice key={value} selected={button.width === value} onClick={() => update(index, { width: value })}>
                  {name}
                </Choice>
              ))}
            </Row>
            <Row title="高さ">
              {LEVELS.map((level) => (
                <Choice key={level} selected={button.height === level} onClick={() => update(index, { height: level })}>
                  {LEVEL_NAMES[level]}
                </Choice>
              ))}
            </Row>
            <Row title="文字">
              {LEVELS.map((level) => (
                <Choice
                  key={level}
                  selected={button.textSize === level}
                  onClick={() => update(index, { textSize: level })}
                >
                  {LEVEL_NAMES[level]}
                </Choice>
              ))}
            </Row>
            <Row title="色">
              {(Object.keys(COLORS) as ButtonColor[]).map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`色: ${COLORS[color].name}`}
                  aria-pressed={button.color === color}
                  onClick={() => update(index, { color })}
                  className={`flex size-10 items-center justify-center rounded-full ${COLORS[color].swatch} ${
                    button.color === color ? 'ring-2 ring-primary-blue ring-offset-2' : ''
                  }`}
                >
                  {button.color === color && (
                    <Icon name="check" className={`text-xl ${color === 'white' || color === 'gray' ? 'text-gray-800' : 'text-white'}`} />
                  )}
                </button>
              ))}
            </Row>
          </li>
        ))}
      </ul>

      {unused.length > 0 && (
        <div className="rounded-[1rem] border border-dashed border-gray-300 p-3">
          <p className="mb-2 text-sm font-medium text-gray-600">ボタンを追加</p>
          <div className="flex flex-wrap gap-2">
            {unused.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onChange({ buttons: [...buttons, newButton(id)] })}
                className="flex items-center gap-1 rounded-full bg-gray-800 px-4 py-2 text-sm font-medium text-white active:bg-gray-700"
              >
                <Icon name="add" className="text-lg" />
                {BUTTONS[id].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-[0.75rem] bg-red-500/20 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-[0.75rem] bg-gray-200 py-3 font-bold text-gray-800 disabled:opacity-40"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex-1 rounded-[0.75rem] bg-primary-blue py-3 font-bold text-white disabled:opacity-40"
          >
            {saving ? '保存中...' : '完了'}
          </button>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={saving}
          className="flex items-center justify-center gap-1 py-2 text-sm text-gray-500 disabled:opacity-40"
        >
          <Icon name="restart_alt" className="text-lg" />
          初期状態に戻す
        </button>
      </div>
    </div>
  )
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 flex items-center gap-3">
      <span className="w-10 shrink-0 text-sm text-gray-500">{title}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-w-14 rounded-full px-4 py-2 text-sm font-medium ${
        selected ? 'bg-primary-blue text-white' : 'bg-gray-100 text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function IconButton({
  label,
  icon,
  onClick,
  disabled,
  danger,
}: {
  label: string
  icon: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex size-10 items-center justify-center rounded-full bg-gray-100 disabled:opacity-30 ${
        danger ? 'text-red-600' : 'text-gray-700'
      }`}
    >
      <Icon name={icon} className="text-xl" />
    </button>
  )
}
