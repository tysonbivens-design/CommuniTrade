import type { Metadata } from 'next'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: 'CommuniTrade — Your Neighborhood\'s Shared Shelf',
  description: 'Borrow books, swap DVDs, trade skills with real people in your community.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
