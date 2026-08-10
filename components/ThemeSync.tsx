'use client'

import { useEffect } from 'react'
import type { StoreTheme } from '@/lib/types'

// ตั้ง data-store-theme ที่ <html> ตามธีมที่ร้านค้าเลือกไว้ใน "ตั้งค่า"
// ให้ CSS var --brand ต่างๆ ใน globals.css สลับสีตามได้ทั่วทั้งเว็บ
export default function ThemeSync({ theme }: { theme: StoreTheme | null | undefined }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-store-theme', theme || 'teal')
  }, [theme])
  return null
}
