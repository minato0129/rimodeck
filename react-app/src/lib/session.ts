// ログイン中のユーザー名(画面に表示するためだけに保存する。本人確認には使わない)。保存先は現行版と同じ localStorage。
// プライベートウィンドウなどでは localStorage が使えないことがあるので、すべて try/catch で包む。
const KEY = 'username'

export function getUsername(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setUsername(name: string): void {
  try {
    localStorage.setItem(KEY, name)
  } catch {
    // 保存できなくても処理は続ける
  }
}

export function clearUsername(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // 同上
  }
}
