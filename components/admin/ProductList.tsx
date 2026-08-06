'use client'

import { useEffect, useState } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { supabase } from '@/lib/supabaseClient'
import type { Product, ProductStatus } from '@/lib/types'
import { deleteImageByUrl, deleteImagesByUrls, formatPrice } from '@/lib/utils'
import ProductForm from './ProductForm'
import MarkSoldForm from './MarkSoldForm'
import SortableProductRow from './SortableProductRow'

export default function ProductList({ status }: { status: ProductStatus }) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [sellingId, setSellingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  async function loadProducts() {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('status', status)
      .order('sort_order', { ascending: true })
    setProducts((data as Product[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  async function handleRevertToAvailable(product: Product) {
    setTogglingId(product.id)
    try {
      const { error } = await supabase.from('products').update({ status: 'พร้อมขาย' }).eq('id', product.id)
      if (error) throw error
      // ย้ายไปอยู่แท็บ "สต็อกสินค้าพร้อมขาย" แล้ว ไม่ใช่ของแท็บนี้อีกต่อไป
      setProducts((prev) => prev.filter((p) => p.id !== product.id))
    } catch (err) {
      window.alert('เปลี่ยนสถานะไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = products.findIndex((p) => p.id === active.id)
    const newIndex = products.findIndex((p) => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    // คงชุดค่า sort_order เดิมไว้ทั้งหมด แค่สลับว่าใครได้ค่าไหนตามลำดับใหม่
    // (ไม่แตะสินค้าที่อยู่นอกรายการนี้ เช่น ในแท็บสินค้าขายแล้ว)
    const sortOrders = products.map((p) => p.sort_order)
    const reordered = arrayMove(products, oldIndex, newIndex)
    const next = reordered.map((p, i) => ({ ...p, sort_order: sortOrders[i] }))
    const changed = next.filter((p) => products.find((pp) => pp.id === p.id)?.sort_order !== p.sort_order)

    setProducts(next)

    const results = await Promise.all(
      changed.map((p) => supabase.from('products').update({ sort_order: p.sort_order }).eq('id', p.id))
    )
    if (results.some((r) => r.error)) {
      window.alert('เปลี่ยนลำดับไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
      loadProducts()
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
    return (
      <p className="py-8 text-center font-mono text-sm text-ink/50">
        {status === 'พร้อมขาย' ? 'ยังไม่มีสินค้าพร้อมขาย' : 'ยังไม่มีสินค้าที่ขายแล้ว'}
      </p>
    )
  }

  const activeId = editingId ?? sellingId

  function renderProductRow(product: Product) {
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
  }

  const visible = activeId ? products.filter((p) => p.id === activeId) : products

  if (status === 'พร้อมขาย' && !activeId) {
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visible.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {visible.map((product) => (
              <SortableProductRow key={product.id} product={product}>
                {renderProductRow(product)}
              </SortableProductRow>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    )
  }

  return <div className="space-y-3">{visible.map(renderProductRow)}</div>
}
