'use client'

import { useEffect } from 'react'
import type { StoreTheme } from '@/lib/types'
import { themeToRgbSpace } from '@/lib/types'

export interface StorefrontThemes {
  theme: StoreTheme | null | undefined
  nameTheme: StoreTheme | null | undefined
  priceTheme: StoreTheme | null | undefined
  taglineTheme: StoreTheme | null | undefined
  bgTheme: StoreTheme | null | undefined
  pillTextTheme: StoreTheme | null | undefined
}

// ตั้ง data-store-theme ที่ <html> ตามธีมสีปุ่มกดที่ร้านค้าเลือกไว้
// ให้ CSS var --brand ต่างๆ ใน globals.css สลับสีตามได้ทั่วทั้งเว็บ
//
// ธีมสีข้อความ/พื้นหลังจุดอื่นๆ แยกอิสระจากกันทีละจุด เลยตั้งเป็น CSS var ตรงๆ
// ผ่าน inline style แทน แทนที่จะใช้ data-attribute แบบธีมสีปุ่มกด
export default function ThemeSync({
  theme,
  nameTheme,
  priceTheme,
  taglineTheme,
  bgTheme,
  pillTextTheme,
}: StorefrontThemes) {
  useEffect(() => {
    document.documentElement.setAttribute('data-store-theme', theme || 'teal')
  }, [theme])

  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--name-brand', themeToRgbSpace(nameTheme, 'black'))
    root.setProperty('--price-brand', themeToRgbSpace(priceTheme, 'amber'))
    root.setProperty('--tagline-brand', themeToRgbSpace(taglineTheme, 'teal'))
    root.setProperty('--bg-brand', themeToRgbSpace(bgTheme, 'cream'))
    root.setProperty('--pill-text-brand', themeToRgbSpace(pillTextTheme, 'white'))
  }, [nameTheme, priceTheme, taglineTheme, bgTheme, pillTextTheme])

  return null
}
