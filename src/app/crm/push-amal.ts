'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { talabProfil } from '@/lib/auth'
import { PUSH_COOKIE } from '@/lib/push'

/**
 * Brauzer obunasini bazaga yozish / o'chirish (0055, faqat O'Z hisobi).
 * Endpoint cookie'da ham saqlanadi: chiqishda shu qurilma obunasi o'chiriladi —
 * aks holda keyingi kirgan odam oldingisining xabarlarini olardi.
 */
export async function pushObunaSaqla(obuna: { endpoint: string; p256dh: string; auth: string }, qurilma: string): Promise<boolean> {
  await talabProfil()
  if (!obuna?.endpoint?.startsWith('https://') || !obuna.p256dh || !obuna.auth) return false
  const supabase = await createClient()
  const { error } = await supabase.rpc('push_obuna', {
    p_endpoint: obuna.endpoint,
    p_p256dh: obuna.p256dh,
    p_auth: obuna.auth,
    p_qurilma: qurilma.slice(0, 200) || null,
  })
  if (error) return false
  ;(await cookies()).set(PUSH_COOKIE, obuna.endpoint, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 400,
  })
  return true
}

export async function pushObunaOchir(endpoint: string): Promise<void> {
  await talabProfil()
  const supabase = await createClient()
  await supabase.rpc('push_ochir', { p_endpoint: endpoint })
  ;(await cookies()).delete(PUSH_COOKIE)
}
