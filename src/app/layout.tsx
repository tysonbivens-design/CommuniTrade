import type { Metadata, Viewport } from 'next'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: 'CommuniTrade — Your Neighborhood\'s Shared Shelf',
  description: 'Borrow books, swap DVDs, trade skills with real people in your community.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CommuniTrade',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
    icon: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  themeColor: '#3D2B1F',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js')
                })
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
