/**
 * Ommaviy sayt uchun ustozlar (0126) — kukisiz anon klient (sahifa statik/ISR
 * qoladi). Faqat ommaviy_ustozlar(): saytda=true, manager tasdiqlagan nusxa,
 * admin tanlagan maydonlar. Hujjat nusxasi — anon imzoli havola (Storage RLS
 * faqat "fayli saytda" bo'lganlarga ruxsat beradi).
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'
import { RASM_BUCKET, HUJJAT_BUCKET, type OmmaviyUstoz } from '@/lib/ustoz-profil'

function anon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const kalit = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !kalit) return null
  return createClient<Database>(url, kalit, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function ommaviyUstozlar(slug?: string): Promise<OmmaviyUstoz[]> {
  const db = anon()
  if (!db) return []
  const { data, error } = await db.rpc('ommaviy_ustozlar', { p_slug: slug ?? null })
  if (error || !Array.isArray(data)) return []
  return data as OmmaviyUstoz[]
}

export function rasmHavola(yol: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${RASM_BUCKET}/${yol.split('/').map(encodeURIComponent).join('/')}`
}

export async function hujjatHavolalari(yollar: string[]): Promise<Record<string, string>> {
  const db = anon()
  if (!db || yollar.length === 0) return {}
  const { data } = await db.storage.from(HUJJAT_BUCKET).createSignedUrls(yollar, 3600)
  const h: Record<string, string> = {}
  for (const d of data ?? []) if (d.path && d.signedUrl) h[d.path] = d.signedUrl
  return h
}

/** "2019 yildan" → "7 yil tajriba" */
export function tajribaMatn(yil?: number): string | null {
  if (!yil) return null
  const n = new Date().getFullYear() - yil
  return n <= 0 ? 'yangi ustoz' : `${n} yil tajriba`
}
