import type { ReactNode } from 'react'

type Props = {
  subtitle: string
  children: ReactNode
  footer: ReactNode
}

// login と signup で共通のカード(ロゴ・見出し・フッターのリンク)。
export default function AuthLayout({ subtitle, children, footer }: Props) {
  return (
    <div className="bg-bg-light font-sans min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img src="/logos/logo-light.svg" alt="rimodeck" className="h-16" />
          </div>
          <p className="text-gray-500">{subtitle}</p>
        </div>
        {children}
        <div className="mt-6 text-center text-sm text-gray-600">{footer}</div>
      </div>
    </div>
  )
}
