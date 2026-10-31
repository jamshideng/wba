'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { matn, sanaOqi, sonOqi, summaOqi, telefonOqi, xabarliYol, xatoMatni, ichkiYol } from '@/lib/kiritish'

/**
 * Chegirma maydonlari — Qatnashuvdagidek ikki bosqich.
 * "Necha oy" bo'sh qolsa bosqich muddatsiz (bazada NULL).
 */
function chegirma(fd: FormData): Record<string, unknown> {
  const c1 = matn(fd.get('chegirma_summa')) ? summaOqi(fd.get('chegirma_summa')) ?? 0 : 0
  const c2 = matn(fd.get('chegirma2_summa')) ? summaOqi(fd.get('chegirma2_summa')) ?? 0 : 0
  return {
    chegirma_summa: c1,
    chegirma_oy: sonOqi(fd.get('chegirma_oy')) ?? '',
    chegirma2_summa: c2,
    chegirma2_oy: sonOqi(fd.get('chegirma2_oy')) ?? '',
    chegirma_sabab: matn(fd.get('chegirma_sabab')) ?? '',
  }
}

/** Uchala telefonni tekshiradi. Noto'g'ri bo'lsa — qaysi biri ekanini aytadi. */
function telefonlar(fd: FormData): { ota_tel: string | null; ona_tel: string | null; shaxsiy_tel: string | null } | string {
  const ota = telefonOqi(fd.get('ota_tel'))
  const ona = telefonOqi(fd.get('ona_tel'))
  const shax = telefonOqi(fd.get('shaxsiy_tel'))
  if (ota === undefined) return 'Ota telefoni noto‘g‘ri. Masalan: 90 123 45 67'
  if (ona === undefined) return 'Ona telefoni noto‘g‘ri. Masalan: 90 123 45 67'
  if (shax === undefined) return 'Shaxsiy telefon noto‘g‘ri. Masalan: 90 123 45 67'
  return { ota_tel: ota, ona_tel: ona, shaxsiy_tel: shax }
}

export async function oquvchiQosh(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const forma = '/crm/oquvchilar/yangi'

  const ismi = matn(fd.get('ismi'))
  const familiya = matn(fd.get('familiya'))
  if (!ismi) redirect(xabarliYol(forma, { xato: 'Ismni yozing.' }))

  const tel = telefonlar(fd)
  if (typeof tel === 'string') redirect(xabarliYol(forma, { xato: tel }))

  // Birinchi tanlangan guruh asosiy (chegirma shunga), qolganlari qo'shimcha (0109)
  const guruhlar = ['', '_2', '_3']
    .map((q) => ({ group_id: matn(fd.get(`group_id${q}`)) ?? '', boshlandi: sanaOqi(fd.get(q ? `boshlandi${q}` : 'boshlandi')) ?? '' }))
    .filter((g) => g.group_id)
  if (new Set(guruhlar.map((g) => g.group_id)).size !== guruhlar.length) {
    redirect(xabarliYol(forma, { xato: 'Bitta guruh ikki marta tanlangan.' }))
  }
  const [asosiy, ...qoshimcha] = guruhlar

  const supabase = await createClient()
  const { data: id, error } = await supabase.rpc('oquvchi_qosh', {
    p: {
      fish: [ismi, familiya].filter(Boolean).join(' '),
      tugilgan_sana: sanaOqi(fd.get('tugilgan_sana')) ?? '',
      ...tel,
      izoh: matn(fd.get('izoh')) ?? '',
      group_id: asosiy?.group_id ?? '',
      boshlandi: asosiy?.boshlandi ?? '',
      qoshimcha_guruhlar: qoshimcha,
      ...chegirma(fd),
    },
  })

  if (error) redirect(xabarliYol(forma, { xato: xatoMatni(error) }))

  // oquvchi_qosh to'liq nom oladi; ism va familiya alohida shu yerda yoziladi (0106)
  const { error: ismXato } = await supabase.from('students').update({ ismi: ismi!, familiya }).eq('id', id as string)

  revalidatePath('/crm', 'layout')
  if (ismXato) redirect(xabarliYol(`/crm/oquvchilar/${id}/tahrir`, { xato: `O‘quvchi qo‘shildi, lekin familiya saqlanmadi: ${xatoMatni(ismXato)}` }))
  redirect(xabarliYol(`/crm/oquvchilar/${id}`, { ok: `O‘quvchi qo‘shildi: ${id}` }))
}

export async function oquvchiTahrir(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const id = matn(fd.get('id'))
  if (!id) redirect('/crm/oquvchilar')
  const forma = `/crm/oquvchilar/${id}/tahrir`

  const ismi = matn(fd.get('ismi'))
  if (!ismi) redirect(xabarliYol(forma, { xato: 'Ismni yozing.' }))

  const tel = telefonlar(fd)
  if (typeof tel === 'string') redirect(xabarliYol(forma, { xato: tel }))

  const holat = (['faol', 'tanaffus', 'ketgan'] as const).find((h) => h === fd.get('holat'))
  if (!holat) redirect(xabarliYol(forma, { xato: 'Holatni tanlang.' }))

  const supabase = await createClient()
  const { error } = await supabase
    .from('students')
    .update({
      ismi: ismi!,
      familiya: matn(fd.get('familiya')),
      tugilgan_sana: sanaOqi(fd.get('tugilgan_sana')),
      ...tel,
      izoh: matn(fd.get('izoh')),
      holat: holat!,
      // Tanaffusda bo'lmasa baza o'zi tozalaydi (0046 trigger)
      qaytish_sana: holat === 'tanaffus' ? sanaOqi(fd.get('qaytish_sana')) : null,
      tanaffus_sabab: holat === 'tanaffus' ? matn(fd.get('tanaffus_sabab')) : null,
      // Guruhi yo'q o'quvchida qo'shilgan sana to'g'ridan-to'g'ri (guruhi bor bo'lsa — 0090 o'zi qo'yadi)
      ...(fd.has('qoshilgan_sana') && sanaOqi(fd.get('qoshilgan_sana')) ? { qoshilgan_sana: sanaOqi(fd.get('qoshilgan_sana'))! } : {}),
    })
    .eq('id', id!)

  if (error) redirect(xabarliYol(forma, { xato: xatoMatni(error) }))

  // Guruhga qo'shilgan sanalar — faqat o'zgarganlari (0090)
  let sanaOzgardi = 0
  for (const [kalit, qiymat] of fd.entries()) {
    if (!kalit.startsWith('sana_')) continue
    const eid = kalit.slice(5)
    const yangi = sanaOqi(qiymat)
    if (!yangi || yangi === matn(fd.get(`eski_${eid}`))) continue
    const { error: e } = await supabase.rpc('qoshilgan_sana_ozgartir', { p_enrollment: eid, p_sana: yangi })
    if (e) {
      revalidatePath('/crm', 'layout')
      redirect(xabarliYol(forma, { xato: `Ma’lumot saqlandi, lekin qo‘shilgan sana o‘zgarmadi: ${xatoMatni(e)}` }))
    }
    sanaOzgardi++
  }

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(`/crm/oquvchilar/${id}`, {
    ok: sanaOzgardi ? 'Ma’lumot saqlandi. Qo‘shilgan sana o‘zgardi — oylik hisob qayta yozildi.' : 'Ma’lumot saqlandi.',
  }))
}

export async function guruhgaBiriktir(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const studentId = matn(fd.get('student_id'))
  const groupId = matn(fd.get('group_id'))
  const yol = `/crm/oquvchilar/${studentId}`

  if (!studentId) redirect('/crm/oquvchilar')
  if (!groupId) redirect(xabarliYol(yol, { xato: 'Guruhni tanlang.' }))

  const supabase = await createClient()
  const { error } = await supabase.rpc('guruhga_biriktir', {
    p_student: studentId!,
    p_group: groupId!,
    p_boshlandi: sanaOqi(fd.get('boshlandi')),
    p_chegirma: chegirma(fd),
  })

  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, { ok: 'Guruhga biriktirildi. Oylar hisobi yozildi.' }))
}

/**
 * Guruhga qo'shilgan sanani o'zgartirish (0090). Oylik hisob bazada qayta
 * yoziladi: yangi sanadan oldingi oylar olinadi, yetishmagani qo'shiladi.
 */
export async function qoshilganSanaOzgartir(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const studentId = matn(fd.get('student_id'))
  const enrollmentId = matn(fd.get('enrollment_id'))
  const yol = `/crm/oquvchilar/${studentId}`
  if (!studentId || !enrollmentId) redirect('/crm/oquvchilar')
  const sana = sanaOqi(fd.get('sana'))
  if (!sana) redirect(xabarliYol(yol, { xato: 'Qo‘shilgan sanani tanlang.' }))

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('qoshilgan_sana_ozgartir', {
    p_enrollment: enrollmentId!,
    p_sana: sana!,
  })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  const n = (data ?? {}) as { olindi?: number; qoshildi?: number }
  const hisob = [
    n.qoshildi ? `${n.qoshildi} oy hisobga qo‘shildi` : '',
    n.olindi ? `${n.olindi} oy hisobdan olindi` : '',
  ].filter(Boolean).join(', ')
  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, { ok: `Qo‘shilgan sana o‘zgartirildi.${hisob ? ` ${hisob}.` : ''}` }))
}

/**
 * Shu fan ichida guruhni sana bilan almashtirish (0074). Sanagacha tarix
 * eski guruhda qoladi; o'tish oyining hisobi va to'lovi yangi guruhniki.
 */
export async function guruhAlmashtir(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const studentId = matn(fd.get('student_id'))
  const enrollmentId = matn(fd.get('enrollment_id'))
  const groupId = matn(fd.get('group_id'))
  const yol = `/crm/oquvchilar/${studentId}`
  if (!studentId || !enrollmentId) redirect('/crm/oquvchilar')
  if (!groupId) redirect(xabarliYol(yol, { xato: 'Yangi guruhni tanlang.' }))
  const sana = sanaOqi(fd.get('sana'))
  if (!sana) redirect(xabarliYol(yol, { xato: 'O‘tish sanasini tanlang.' }))

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('guruh_almashtir', {
    p_enrollment: enrollmentId!,
    p_group: groupId!,
    p_sana: sana!,
  })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  const n = (data ?? {}) as { davomat?: number; davomat_qoldi?: number; tolovlar?: number }
  const qoshimcha = [
    n.tolovlar ? `${n.tolovlar} ta to‘lov` : '',
    n.davomat ? `${n.davomat} ta davomat` : '',
  ].filter(Boolean).join(', ')
  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, {
    ok: `Guruh almashtirildi.${qoshimcha ? ` Yangi guruhga o‘tdi: ${qoshimcha}.` : ''}${n.davomat_qoldi ? ` ${n.davomat_qoldi} ta davomat yangi guruhda dars kuni bo‘lmagani uchun eski guruhda qoldi.` : ''}`,
  }))
}

export async function guruhdanChiqar(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const studentId = matn(fd.get('student_id'))
  const enrollmentId = matn(fd.get('enrollment_id'))
  const yol = `/crm/oquvchilar/${studentId}`
  if (!studentId || !enrollmentId) redirect('/crm/oquvchilar')

  const supabase = await createClient()
  const { error } = await supabase.rpc('guruhdan_chiqar', {
    p_enrollment: enrollmentId!,
    p_sana: sanaOqi(fd.get('sana')),
  })

  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, { ok: 'Guruhdan chiqarildi. Keyingi oylar hisobdan olindi.' }))
}

/**
 * Chegirmani istalgan vaqtda o'zgartirish. Hamma oylar qayta
 * hisoblanadi — Sheets formulasi ham shunday qiladi (0014).
 */
export async function chegirmaOzgartir(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const studentId = matn(fd.get('student_id'))
  const enrollmentId = matn(fd.get('enrollment_id'))
  const yol = `/crm/oquvchilar/${studentId}`
  if (!studentId || !enrollmentId) redirect('/crm/oquvchilar')

  const supabase = await createClient()
  const { data: soni, error } = await supabase.rpc('chegirma_ozgartir', {
    p_enrollment: enrollmentId!,
    p: chegirma(fd),
  })

  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, { ok: `Chegirma saqlandi. ${soni ?? 0} oyning hisobi qayta hisoblandi.` }))
}

/**
 * Tuzatish — shu oy uchun aniq summani ayirish (Sheets "Tuzatishlar",
 * 0029). Sababli kelmagan darslar yoki oy o'rtasida boshlagan bola.
 * Faqat admin va direktor; bazada ham tekshiriladi.
 */
export async function tuzatishQosh(fd: FormData) {
  await talabRol('admin', 'direktor')
  const studentId = matn(fd.get('student_id'))
  const enrollmentId = matn(fd.get('enrollment_id'))
  const yol = `/crm/oquvchilar/${studentId}`
  if (!studentId || !enrollmentId) redirect('/crm/oquvchilar')

  const davr = matn(fd.get('davr'))
  const summa = summaOqi(fd.get('summa'))
  const sabab = matn(fd.get('sabab'))
  if (!davr || !/^\d{4}-(0[1-9]|1[0-2])$/.test(davr)) redirect(xabarliYol(yol, { xato: 'Oyni tanlang.' }))
  if (!summa) redirect(xabarliYol(yol, { xato: 'Ayiriladigan summani yozing. Masalan: 150000 yoki 150.' }))
  if (!sabab) redirect(xabarliYol(yol, { xato: 'Sababini yozing — masalan: kasal, 3 dars.' }))

  const supabase = await createClient()
  const { error } = await supabase.rpc('tuzatish_qosh', {
    p_enrollment: enrollmentId!,
    p_davr: davr!,
    p_summa: summa!,
    p_sabab: sabab!,
  })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, { ok: `Tuzatish yozildi: ${davr} oyidan ${summa!.toLocaleString('ru-RU')} so‘m ayirildi.` }))
}

export async function tuzatishBekor(fd: FormData) {
  await talabRol('admin', 'direktor')
  const studentId = matn(fd.get('student_id'))
  const id = sonOqi(fd.get('id'))
  const yol = `/crm/oquvchilar/${studentId}`
  if (!studentId || !id) redirect('/crm/oquvchilar')

  const supabase = await createClient()
  const { error } = await supabase.rpc('tuzatish_bekor', { p_id: id!, p_sabab: matn(fd.get('sabab')) })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, { ok: 'Tuzatish bekor qilindi — o‘sha oy qayta hisoblandi.' }))
}

/** VIP — to'lamaydi, lekin faol hisobda (0030). Faqat admin va direktor. */
export async function vipOzgartir(fd: FormData) {
  await talabRol('admin', 'direktor')
  const studentId = matn(fd.get('student_id'))
  const enrollmentId = matn(fd.get('enrollment_id'))
  const yol = `/crm/oquvchilar/${studentId}`
  if (!studentId || !enrollmentId) redirect('/crm/oquvchilar')

  const vip = fd.get('vip') === '1'
  const dan = matn(fd.get('dan'))
  const supabase = await createClient()
  const { error } = await supabase.rpc('vip_ozgartir', { p_enrollment: enrollmentId!, p_vip: vip, p_dan: vip ? dan : null })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, { ok: vip ? `VIP qilindi${dan ? ` (${dan} dan)` : ''} — o‘sha oylardan hisob 0.` : 'VIP olib tashlandi — oylar qayta hisoblandi.' }))
}

/** Arxivga — hamma guruhdan chiqariladi, qarzi saqlanadi, shu ID bilan qaytariladi. */
export async function oquvchiArxivla(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const studentId = matn(fd.get('student_id'))
  const yol = `/crm/oquvchilar/${studentId}`
  if (!studentId) redirect('/crm/oquvchilar')

  // 0083 — sabab ro'yxatdan majburiy; "Boshqa" bo'lsa izoh ham
  const turi = matn(fd.get('turi'))
  if (!turi) redirect(xabarliYol(yol, { xato: 'Ketish sababini tanlang.' }))
  if (turi === 'boshqa' && !matn(fd.get('sabab'))) redirect(xabarliYol(yol, { xato: '“Boshqa” tanlansa, sababini yozing.' }))

  const supabase = await createClient()
  const { error } = await supabase.rpc('oquvchi_arxivla', {
    p_student: studentId!,
    p_sana: sanaOqi(fd.get('sana')),
    p_sabab: matn(fd.get('sabab')),
    p_turi: turi,
  })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, { ok: 'Arxivga o‘tkazildi. Qarzi saqlanadi; qaytarish — shu sahifadan.' }))
}

/** Xato kiritilgan o'quvchini butunlay o'chirish (0109). To'siq va huquq bazada tekshiriladi. */
export async function oquvchiXatoOchir(fd: FormData) {
  await talabRol('admin', 'direktor')
  const studentId = matn(fd.get('student_id'))
  if (!studentId) redirect('/crm/oquvchilar')
  const yol = `/crm/oquvchilar/${studentId}`

  if (matn(fd.get('tasdiq'))?.toUpperCase() !== studentId) {
    redirect(xabarliYol(yol, { xato: `Tasdiqlash uchun ${studentId} deb yozing.` }))
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('oquvchi_xato_ochir', { p_student: studentId!, p_sabab: matn(fd.get('sabab')) ?? '' })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol('/crm/oquvchilar', { ok: `${studentId} o‘chirildi.` }))
}

export async function oquvchiArxivdan(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const studentId = matn(fd.get('student_id'))
  const yol = `/crm/oquvchilar/${studentId}`
  if (!studentId) redirect('/crm/oquvchilar')

  const supabase = await createClient()
  const { error } = await supabase.rpc('oquvchi_arxivdan', { p_student: studentId! })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, { ok: 'Arxivdan qaytarildi (shu ID bilan). Endi guruhga biriktiring.' }))
}

/** Arxivdagi o'quvchiga ketish sababini qo'yish yoki o'zgartirish (0083) */
export async function ketishSababiBelgila(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const studentId = matn(fd.get('student_id'))
  const turi = matn(fd.get('turi'))
  const y = ichkiYol(fd.get('qaytish'))
  const orqaga = y.startsWith('/crm/') ? y : '/crm/arxiv'
  if (!studentId || !turi) redirect(xabarliYol(orqaga, { xato: 'Sababni tanlang.' }))

  const supabase = await createClient()
  const { error } = await supabase.rpc('ketish_sababi_belgila', { p_student: studentId!, p_turi: turi!, p_izoh: matn(fd.get('izoh')) })
  if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))
  revalidatePath('/crm/arxiv')
  revalidatePath('/crm/oquvchilar/ketish')
  redirect(xabarliYol(orqaga, { ok: 'Sabab saqlandi.' }))
}
