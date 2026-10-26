// /login と /signup は同じ形式(JSON で username / password を POST)。
export type Credentials = { username: string; password: string }

export async function postCredentials(
  path: '/login' | '/signup',
  credentials: Credentials,
): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  })
}
