'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Product } from '@/lib/types'
import { deleteImageByUrl, deleteImagesByUrls, formatPrice } from '@/lib/utils'
import ProductForm from './ProductForm'
import MarkSoldForm from './MarkSoldForm'

export default function ProductList() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [sellingId, setSellingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function loadProducts() {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    setProducts((data as Product[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadProducts()
  }, [])

  async function handleRevertToAvailable(product: Product) {
    setTogglingId(product.id)
    try {
      const { error } = await supabase.from('products').update({ status: 'พร้อมขาย' }).eq('id', product.id)
      if (error) throw error
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, status: 'พร้อมขาย' } : p)))
    } catch (err) {
      window.alert('เปลี่ยนสถานะไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDelete(product: Product) {
    const confirmed = window.confirm(`ลบ "${product.model_name}" (${product.product_code}) ออกจากสต็อกใช่หรือไม่?`)
    if (!confirmed) return

    setDeletingId(product.id)
    try {
      const { error } = await supabase.from('products').delete().eq('id', product.id)
      if (error) throw error

      await deleteImageByUrl('product-images', product.cover_image_url)
      if (product.gallery_images?.length) {
        await deleteImagesByUrls('product-images', product.gallery_images)
      }

      setProducts((prev) => prev.filter((p) => p.id !== product.id))
    } catch (err) {
      window.alert('ลบสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return <p className="py-8 text-center font-mono text-sm text-ink/50">กำลังโหลดรายการสินค้า…</p>
  }

  if (products.length === 0) {
    return <p className="py-8 text-center font-mono text-sm text-ink/50">ยังไม่มีสินค้าในสต็อก</p>
  }

  const activeId = editingId ?? sellingId

  return (
    <div className="space-y-3">
      {products.map((product) => {
        if (activeId && activeId !== product.id) return null
        const isEditing = editingId === product.id
        const isSelling = sellingId === product.id
        return (
          <div key={product.id} className="rounded-card border border-line bg-panel">
            {isEditing ? (
              <div className="p-3">
                <ProductForm
                  mode="edit"
                  initialProduct={product}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => {
                    setEditingId(null)
                    loadProducts()
                  }}
                />
              </div>
            ) : isSelling ? (
              <MarkSoldForm
                product={product}
                onCancel={() => setSellingId(null)}
                onSaved={() => {
                  setSellingId(null)
                  loadProducts()
                }}
              />
            ) : (
              <div className="flex items-center gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.cover_image_url}
                  alt={product.model_name}
                  className="h-14 w-14 shrink-0 rounded-tag border border-line object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-semibold text-ink">{product.model_name}</p>
                  <p className="font-mono text-xs text-ink/50">
                    {product.product_code} · {product.status}
                  </p>
                  <p className="font-mono text-sm font-semibold text-amber-dark">{formatPrice(product.price)}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <button
                    onClick={() => setEditingId(product.id)}
                    className="rounded-tag border border-amber-dark px-3 py-1.5 font-mono text-xs text-amber-dark"
                  >
                    แก้ไข
                  </button>
                  {product.status === 'ขายแล้ว' ? (
                    <>
                      <button
                        onClick={() => setSellingId(product.id)}
                        className="rounded-tag border border-teal px-3 py-1.5 font-mono text-xs text-teal-dark"
                      >
                        แก้ไขข้อมูลขาย
                      </button>
                      <button
                        onClick={() => handleRevertToAvailable(product)}
                        disabled={togglingId === product.id}
                        className="rounded-tag border border-teal px-3 py-1.5 font-mono text-xs text-teal-dark disabled:opacity-50"
                      >
                        {togglingId === product.id ? 'กำลังบันทึก…' : 'คืนเป็นพร้อมขาย'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setSellingId(product.id)}
                      className="rounded-tag border border-teal px-3 py-1.5 font-mono text-xs text-teal-dark"
                    >
                      ขายแล้ว
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(product)}
                    disabled={deletingId === product.id}
                    className="rounded-tag border border-danger px-3 py-1.5 font-mono text-xs text-danger disabled:opacity-50"
                  >
                    {deletingId === product.id ? 'กำลังลบ…' : 'ลบ'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
