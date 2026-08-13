'use client'

import { useEffect, useState } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { supabase } from '@/lib/supabaseClient'
import { CATEGORY_TABS, OWNERS } from '@/lib/types'
import type { CategoryTab, Product, ProductOwner, ProductStatus } from '@/lib/types'
import { STAGNANT_DAYS, daysSince, deleteImageByUrl, deleteImagesByUrls, formatPrice } from '@/lib/utils'
import ProductForm from './ProductForm'
import MarkSoldForm from './MarkSoldForm'
import SortableProductRow from './SortableProductRow'
import SortableCategoryPill from './SortableCategoryPill'

type OwnerFilter = 'ทั้งหมด' | ProductOwner | 'ไม่ระบุ'

type Props = {
  status: ProductStatus
  openProductId?: string | null
  onOpenedProduct?: () => void
}

export default function ProductList({ status, openProductId, onOpenedProduct }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [sellingId, setSellingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [categoryOrder, setCategoryOrder] = useState<CategoryTab[]>(CATEGORY_TABS)
  const [activeTab, setActiveTab] = useState<CategoryTab>('ทั้งหมด')
  const [activeOwner, setActiveOwner] = useState<OwnerFilter>('ทั้งหมด')
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

  // มาจากลิงก์รหัสสินค้าในหน้ารายงาน — เปิดฟอร์มแก้ไขของสินค้านั้นตรงๆ
  // ต้องเคลียร์ตัวกรองหมวดหมู่/เจ้าของทุนก่อน ไม่งั้นสินค้าอาจถูกกรองซ่อนอยู่จนหาฟอร์มไม่เจอ
  useEffect(() => {
    if (!openProductId || loading) return
    const target = products.find((p) => p.id === openProductId)
    if (target) {
      setActiveTab('ทั้งหมด')
      setActiveOwner('ทั้งหมด')
      setEditingId(openProductId)
    }
    onOpenedProduct?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openProductId, loading, products])

  useEffect(() => {
    // ลำดับหมวดหมู่เป็นค่าที่ใช้ร่วมกันทั้งสองแท็บและหน้าร้าน จึงโหลดครั้งเดียว
    async function loadCategoryOrder() {
      const { data } = await supabase.from('store_settings').select('category_order').eq('id', 1).maybeSingle()
      const order = (data as { category_order: CategoryTab[] | null } | null)?.category_order
      if (order?.length) setCategoryOrder(order)
    }
    loadCategoryOrder()
  }, [])

  async function handleCategoryDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = categoryOrder.findIndex((c) => c === active.id)
    const newIndex = categoryOrder.findIndex((c) => c === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const previous = categoryOrder
    const next = arrayMove(categoryOrder, oldIndex, newIndex)
    setCategoryOrder(next)

    const { error } = await supabase.from('store_settings').update({ category_order: next }).eq('id', 1)
    if (error) {
      window.alert('เปลี่ยนลำดับหมวดหมู่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
      setCategoryOrder(previous)
    }
  }

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

  async function handleDragEnd(scope: CategoryTab, event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    // แท็บ "ทั้งหมด" ลากสลับ sort_order (ลำดับ "แนะนำ" ข้ามหมวด) ส่วนแท็บหมวดหมู่ ลากสลับ category_sort_order
    // (ลำดับเฉพาะภายในหมวดนั้น) — สองค่านี้แยกอิสระจากกันไม่กระทบกัน
    const field = scope === 'ทั้งหมด' ? 'sort_order' : 'category_sort_order'
    const group = (scope === 'ทั้งหมด' ? products : products.filter((p) => p.category === scope))
      .slice()
      .sort((a, b) => a[field] - b[field])
    const oldIndex = group.findIndex((p) => p.id === active.id)
    const newIndex = group.findIndex((p) => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    // คงชุดค่าเดิมของฟิลด์นี้ไว้ทั้งหมด แค่สลับว่าใครได้ค่าไหนตามลำดับใหม่
    const values = group.map((p) => p[field])
    const reordered = arrayMove(group, oldIndex, newIndex)
    const remapped = reordered.map((p, i) => ({ ...p, [field]: values[i] }))
    const changed = remapped.filter((p) => group.find((gp) => gp.id === p.id)?.[field] !== p[field])

    const next = products
      .map((p) => remapped.find((rp) => rp.id === p.id) ?? p)
      .sort((a, b) => a.sort_order - b.sort_order)
    setProducts(next)

    const results = await Promise.all(
      changed.map((p) => supabase.from('products').update({ [field]: p[field] }).eq('id', p.id))
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
      // สินค้าที่ซื้อผ่านโอน TTB จะมีใบสำคัญรับเงินผูกอยู่ (ออกให้อัตโนมัติตอนเพิ่มสินค้า)
      // ฐานข้อมูลกันไม่ให้ลบสินค้าที่มีใบสำคัญรับเงินผูกอยู่ (product_id...on delete restrict)
      // ลบใบสำคัญรับเงินทิ้งไปด้วยก่อนเสมอ ไม่งั้นลบสินค้าไม่ได้เลย
      await supabase.from('receipt_vouchers').delete().eq('product_id', product.id)

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
    const emptyMessage =
      status === 'พร้อมขาย'
        ? 'ยังไม่มีสินค้าพร้อมขาย'
        : status === 'ไม่พร้อมขาย'
          ? 'ยังไม่มีสินค้าที่ตั้งเป็นไม่พร้อมขาย'
          : 'ยังไม่มีสินค้าที่ขายแล้ว'
    return <p className="py-8 text-center font-mono text-sm text-ink/50">{emptyMessage}</p>
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
            {product.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.cover_image_url}
                alt={product.model_name}
                className="h-14 w-14 shrink-0 rounded-tag border border-line object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-tag border border-line bg-paper text-center font-mono text-[9px] leading-tight text-ink/40">
                ลบรูปแล้ว
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-semibold text-ink">{product.model_name}</p>
              <p className="font-mono text-xs text-ink/50">
                {product.product_code} · {product.status}
              </p>
              <p className="font-mono text-sm font-semibold text-amber-dark">{formatPrice(product.price)}</p>
              {product.status === 'พร้อมขาย' && daysSince(product.listed_at) > STAGNANT_DAYS && (
                <span className="mt-1 inline-block rounded-tag bg-danger/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-danger">
                  ค้าง {daysSince(product.listed_at)} วัน
                </span>
              )}
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
              ) : product.status === 'ไม่พร้อมขาย' ? (
                <button
                  onClick={() => handleRevertToAvailable(product)}
                  disabled={togglingId === product.id}
                  className="rounded-tag border border-teal px-3 py-1.5 font-mono text-xs text-teal-dark disabled:opacity-50"
                >
                  {togglingId === product.id ? 'กำลังบันทึก…' : 'ตั้งเป็นพร้อมขาย'}
                </button>
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

  if (activeId) {
    const visible = products.filter((p) => p.id === activeId)
    return <div className="space-y-3">{visible.map(renderProductRow)}</div>
  }

  // สินค้าขายแล้วคือข้อมูลปิดจบแล้ว ไม่ต้องจัดลำดับ แค่กรองดูทีละหมวดให้ง่ายขึ้น
  const canReorder = status === 'พร้อมขาย'

  const categoryFiltered =
    activeTab === 'ทั้งหมด'
      ? products
      : products
          .filter((p) => p.category === activeTab)
          .sort((a, b) => a.category_sort_order - b.category_sort_order)

  const displayed =
    activeOwner === 'ทั้งหมด'
      ? categoryFiltered
      : activeOwner === 'ไม่ระบุ'
        ? categoryFiltered.filter((p) => !p.owner)
        : categoryFiltered.filter((p) => p.owner === activeOwner)

  // ลากจัดลำดับได้เฉพาะตอนดู "ทั้งหมด" ของเจ้าของทุน ไม่งั้นตำแหน่งที่ลากในรายการที่กรองแล้ว
  // จะไม่ตรงกับลำดับจริงของสินค้าทั้งหมด (sort_order/category_sort_order)
  const canReorderProducts = canReorder && activeOwner === 'ทั้งหมด'

  return (
    <div>
      <div className="pill-row mb-3">
        {canReorder ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
            <SortableContext items={categoryOrder} strategy={horizontalListSortingStrategy}>
              {categoryOrder.map((category) => (
                <SortableCategoryPill
                  key={category}
                  category={category}
                  active={activeTab === category}
                  onSelect={() => setActiveTab(category)}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          categoryOrder.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveTab(category)}
              className={`shrink-0 rounded-tag border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
                activeTab === category
                  ? 'border-teal bg-teal text-white'
                  : 'border-line bg-panel text-ink/70 active:bg-line/40'
              }`}
            >
              {category}
            </button>
          ))
        )}
      </div>

      {status === 'พร้อมขาย' && (
        <div className="pill-row mb-3">
          {(['ทั้งหมด', ...OWNERS, 'ไม่ระบุ'] as OwnerFilter[]).map((owner) => (
            <button
              key={owner}
              type="button"
              onClick={() => setActiveOwner(owner)}
              className={`shrink-0 rounded-tag border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
                activeOwner === owner
                  ? 'border-teal bg-teal text-white'
                  : 'border-line bg-panel text-ink/70 active:bg-line/40'
              }`}
            >
              {owner}
            </button>
          ))}
        </div>
      )}

      {displayed.length === 0 ? (
        <p className="py-8 text-center font-mono text-sm text-ink/50">
          {activeOwner === 'ทั้งหมด'
            ? 'ไม่มีสินค้าในหมวดนี้'
            : activeOwner === 'ไม่ระบุ'
              ? 'ไม่มีสินค้าที่ไม่ระบุเจ้าของทุนในหมวดนี้'
              : `ไม่มีสินค้าของ ${activeOwner} ในหมวดนี้`}
        </p>
      ) : canReorderProducts ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => handleDragEnd(activeTab, event)}
        >
          <SortableContext items={displayed.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {displayed.map((product) => (
                <SortableProductRow key={product.id} product={product}>
                  {renderProductRow(product)}
                </SortableProductRow>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-3">{displayed.map(renderProductRow)}</div>
      )}
    </div>
  )
}
