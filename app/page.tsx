'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Product, StoreSettings } from '@/lib/types'
import Header from '@/components/Header'
import FilterBar from '@/components/FilterBar'
import ProductCard from '@/components/ProductCard'
import ProductModal from '@/components/ProductModal'

export default function StorefrontPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('ทั้งหมด')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Product | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      const [{ data: productsData }, { data: settingsData }] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .eq('status', 'พร้อมขาย')
          .order('created_at', { ascending: false }),
        supabase.from('store_settings').select('*').eq('id', 1).maybeSingle(),
      ])
      if (!active) return
      setProducts((productsData as Product[]) ?? [])
      setSettings((settingsData as StoreSettings) ?? null)
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = category === 'ทั้งหมด' || p.category === category
      const q = search.trim().toLowerCase()
      const matchesSearch =
        q === '' ||
        p.model_name.toLowerCase().includes(q) ||
        p.product_code.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
  }, [products, category, search])

  return (
    <main className="min-h-screen bg-paper pb-10">
      <Header settings={settings} />
      <FilterBar
        activeCategory={category}
        onCategoryChange={setCategory}
        search={search}
        onSearchChange={setSearch}
      />

      <div className="mx-auto max-w-3xl px-4 pt-4">
        {loading && (
          <p className="py-16 text-center font-mono text-sm text-ink/50">กำลังโหลดสต็อกสินค้า…</p>
        )}

        {!loading && filtered.length === 0 && (
          <div className="py-16 text-center">
            <p className="font-display text-lg text-ink">ยังไม่มีสินค้าในหมวดนี้</p>
            <p className="mt-1 font-mono text-xs text-ink/50">ลองเปลี่ยนหมวดหมู่หรือคำค้นหาดูอีกครั้ง</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} onSelect={setSelected} />
            ))}
          </div>
        )}
      </div>

      {selected && <ProductModal product={selected} onClose={() => setSelected(null)} />}
    </main>
  )
}
