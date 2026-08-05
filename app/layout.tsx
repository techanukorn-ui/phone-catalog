import type { Metadata } from 'next'
import { Chakra_Petch, IBM_Plex_Sans_Thai, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

const display = Chakra_Petch({
  subsets: ['thai', 'latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
})

const body = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
})

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'แค็ตตาล็อกสินค้า | มือถือ-แท็บเล็ตมือสอง',
  description: 'แค็ตตาล็อกสต็อกมือถือและแท็บเล็ตมือสองสำหรับส่งลิงก์ให้ลูกค้าดูทาง Facebook Inbox',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={`${display.variable} ${body.variable} ${mono.variable} font-body`}>
        {children}
      </body>
    </html>
  )
}
