import type { Metadata, Viewport } from 'next'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: 'CommuniTrade — Your Neighborhood\'s Shared Shelf',
  description: 'Borrow books, swap DVDs, lend tools, and trade skills with real neighbors in your community. Free, no ads, no corporations. Just neighbors helping neighbors in Tucson.',
  manifest: '/manifest.json',
  keywords: ['community sharing', 'neighborhood lending', 'borrow tools', 'Tucson', 'free items', 'barter', 'community trade', 'hyperlocal'],
  authors: [{ name: 'CommuniTrade' }],
  creator: 'CommuniTrade',
  metadataBase: new URL('https://communitrade.app'),
  alternates: {
    canonical: 'https://communitrade.app',
  },
  openGraph: {
    type: 'website',
    url: 'https://communitrade.app',
    title: 'CommuniTrade — Your Neighborhood\'s Shared Shelf',
    description: 'Borrow books, lend tools, trade skills with real neighbors. Free community sharing — no ads, no corporations.',
    siteName: 'CommuniTrade',
    images: [
      {
        url: 'https://communitrade.app/icons/og-image.png',
        width: 1200,
        height: 630,
        alt: 'CommuniTrade — Your Neighborhood\'s Shared Shelf',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CommuniTrade — Your Neighborhood\'s Shared Shelf',
    description: 'Borrow books, lend tools, trade skills with real neighbors. Free community sharing.',
    images: ['https://communitrade.app/icons/og-image.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CommuniTrade',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
    icon: '/favicon.ico',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
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
