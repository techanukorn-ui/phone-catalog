'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import type { Product, StoreSettings } from '@/lib/types'
import Header from '@/components/Header'
import FilterBar, { type SortOption } from '@/components/FilterBar'
import ProductCard from '@/components/ProductCard'
import ProductModal from '@/components/ProductModal'
import ThemeSync from '@/components/ThemeSync'

export default function StorefrontPage() {
  return (
    <Suspense fallback={null}>
      <StorefrontPageContent />
    </Suspense>
  )
}

function StorefrontPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('ทั้งหมด')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('newest')
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
          .order('sort_order', { ascending: true }),
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

  useEffect(() => {
    // เปิดสินค้าที่ระบุใน URL (?p=id) อัตโนมัติ ใช้ตอนมีคนแชร์ลิงก์สินค้ามา
    if (loading || selected) return
    const sharedId = searchParams.get('p')
    if (!sharedId) return
    const found = products.find((p) => p.id === sharedId)
    if (found) setSelected(found)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, products])

  function handleSelectProduct(product: Product) {
    setSelected(product)
    router.replace(`${pathname}?p=${product.id}`, { scroll: false })
  }

  function handleCloseModal() {
    setSelected(null)
    router.replace(pathname, { scroll: false })
  }

  const filtered = useMemo(() => {
    const result = products.filter((p) => {
      const matchesCategory = category === 'ทั้งหมด' || p.category === category
      const q = search.trim().toLowerCase()
      const matchesSearch =
        q === '' ||
        p.model_name.toLowerCase().includes(q) ||
        p.product_code.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
    if (sort === 'price-asc') {
      result.sort((a, b) => a.price - b.price)
    } else if (sort === 'price-desc') {
      result.sort((a, b) => b.price - a.price)
    } else if (category !== 'ทั้งหมด') {
      // กรองเฉพาะหมวดหมู่ → เรียงตามลำดับที่ตั้งไว้เฉพาะหมวดนั้น แยกจากลำดับ "แนะนำ" โดยรวม
      result.sort((a, b) => a.category_sort_order - b.category_sort_order)
    }
    return result
  }, [products, category, search, sort])

  return (
    <main className="min-h-screen bg-paper pb-10">
      <ThemeSync theme={settings?.theme} />
      <Header settings={settings} />
      <FilterBar
        categories={settings?.category_order ?? undefined}
        activeCategory={category}
        onCategoryChange={setCategory}
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
      />

      <div className="mx-auto max-w-3xl px-4 pt-4 lg:max-w-6xl">
        {loading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex flex-col overflow-hidden rounded-card border border-line bg-panel">
                <div className="skeleton-shimmer aspect-square w-full" />
                <div className="flex flex-col gap-2 p-3">
                  <div className="skeleton-shimmer h-3.5 w-4/5 rounded-tag" />
                  <div className="skeleton-shimmer h-3.5 w-2/5 rounded-tag" />
                  <div className="skeleton-shimmer mt-2 h-5 w-1/2 rounded-tag" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="py-16 text-center">
            <p className="font-display text-lg text-ink">ยังไม่มีสินค้าในหมวดนี้</p>
            <p className="mt-1 font-mono text-xs text-ink/50">ลองเปลี่ยนหมวดหมู่หรือคำค้นหาดูอีกครั้ง</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} onSelect={handleSelectProduct} />
            ))}
          </div>
        )}
      </div>

      {selected && <ProductModal product={selected} onClose={handleCloseModal} />}
    </main>
  )
}
