import Link from 'next/link'
import { Card, CardHeader, Badge, Empty } from '@/components/ui'
import { Maydon, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { sana } from '@/lib/format'
import {
  asosiySaqla,
  sertifikatSaqla,
  yutuqSaqla,
  talimSaqla,
  mehnatSaqla,
  shaxsiySaqla,
  qatorOchir,
  korinishSaqla,
  cvTasdiqla,
  cvQaytar,
} from '@/app/crm/malumotlarim/actions'
import { FaylYuklash } from './fayl-yuklash'
import {
  SERTIFIKAT_TURLARI,
  DARAJA_NOMI,
  MALUMOTI_NOMI,
  HOLAT_NOMI,
  QOLGAN_NOMI,
  KORINISH_MAYDONLARI,
  MAYDON_NOMI,
  JADVAL_BOLIM,
  type UstozProfilMalumot,
  type Sertifikat,
  type Yutuq,
  type Talim,
  type Mehnat,
} from '@/lib/ustoz-profil'
import { SanaKiritish } from '@/components/sana-kiritish'

const vaqtFmt = new Intl.DateTimeFormat('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

type Farq = { nom: string; eski: string; yangi: string }

/** Tasdiqlangan nusxa bilan hozirgi CV farqi (manager uchun) */
function farqlar(eski: Record<string, unknown> | null, yangi: Record<string, unknown> | null): Farq[] {
  if (!yangi) return []
  const e = eski ?? {}
  const satr = (v: unknown, k: string): string => {
    if (v == null || v === '') return '—'
    if (k === 'rasm_yol') return 'rasm'
    if (Array.isArray(v)) {
      if (k === 'sertifikatlar') return v.map((x: Record<string, unknown>) => `${x.turi}${x.ball ? ' ' + x.ball : ''}`).join(', ') || '—'
      if (k === 'yutuqlar') return v.map((x: Record<string, unknown>) => String(x.nomi)).join('; ') || '—'
      if (k === 'talim') return v.map((x: Record<string, unknown>) => `${x.otm}${x.yonalish ? ' — ' + x.yonalish : ''}`).join('; ') || '—'
      return v.join(', ') || '—'
    }
    return String(v)
  }
  const nomlar: Record<string, string> = {
    rasm_yol: 'Rasm',
    tavsif: 'Tavsif',
    fanlar: 'Fanlar',
    dars_boshlagan_yil: 'Dars boshlagan yil',
    tillar: 'Tillar',
    sertifikatlar: 'Sertifikatlar',
    yutuqlar: 'Yutuqlar',
    talim: 'Ta’lim',
  }
  const chiq: Farq[] = []
  for (const [k, nom] of Object.entries(nomlar)) {
    const a = JSON.stringify(e[k] ?? null)
    const b = JSON.stringify(yangi[k] ?? null)
    if (a !== b) chiq.push({ nom, eski: satr(e[k], k), yangi: satr(yangi[k], k) })
  }
  return chiq
}

function Yashirin({ teacherId, qaytish }: { teacherId: string; qaytish: string }) {
  return (
    <>
      <input type="hidden" name="teacher_id" value={teacherId} />
      <input type="hidden" name="qaytish" value={qaytish} />
    </>
  )
}

function OchirishTugma({ teacherId, qaytish, tur, id }: { teacherId: string; qaytish: string; tur: string; id: number }) {
  return (
    <form action={qatorOchir}>
      <Yashirin teacherId={teacherId} qaytish={qaytish} />
      <input type="hidden" name="tur" value={tur} />
      <input type="hidden" name="id" value={id} />
      <Yuborish tur="xavfli" kutish="…">O‘chirish</Yuborish>
    </form>
  )
}

/**
 * Ustoz profili — "Ma'lumotlarim" (ustoz) va admin sahifasi uchun bitta komponent.
 * admin: saytda ko'rsatish sozlamalari; manager: tasdiq va farq.
 */
export function UstozProfilSahifa({
  m,
  qaytish,
  admin,
  manager,
  joriyNusxa,
  docxHavola,
}: {
  m: UstozProfilMalumot
  qaytish: string
  admin: boolean
  manager: boolean
  /** ustoz_cv_nusxa() — hozirgi CV (manager farqi uchun) */
  joriyNusxa: Record<string, unknown> | null
  docxHavola: string
}) {
  const { profil: p, ustoz: u } = m
  const tid = u.id
  const sh = m.shaxsiy
  const yil = new Date().getFullYear()
  const foiz = m.toldirish?.foiz ?? 0
  const farq = manager && p.holat === 'kutilmoqda' ? farqlar(p.ommaviy, joriyNusxa) : []
  const holatTon = p.holat === 'tasdiqlangan' ? 'ok' : p.holat === 'qaytarildi' ? 'brand' : p.holat === 'kutilmoqda' ? 'accent' : 'jim'

  return (
    <div className="flex flex-col gap-4">
      {/* ── Holat va to'ldirilganlik ── */}
      <Card className="flex flex-col gap-3 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge ton={holatTon}>{HOLAT_NOMI[p.holat]}</Badge>
            {admin && <Badge ton={p.saytda ? 'ok' : 'jim'}>{p.saytda ? 'Saytda ko‘rinadi' : 'Saytda yashirin'}</Badge>}
            {p.saytda && p.slug && p.ommaviy && (
              <Link href={`/ustozlar/${p.slug}`} target="_blank" className="text-[12.5px] text-accent underline underline-offset-2">
                wbalc.uz/ustozlar/{p.slug}
              </Link>
            )}
          </div>
          <a href={docxHavola} className="inline-flex min-h-11 items-center rounded-[10px] border border-line bg-surface px-4 text-[13px] font-semibold text-ink-2 hover:border-ink-3 hover:text-ink">
            Obyektivka (Word)
          </a>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="text-ink-2">To‘ldirilgan</span>
            <span className="tnum font-[family-name:var(--font-mono)] font-semibold">{foiz}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className={`h-full rounded-full ${foiz >= 100 ? 'bg-ok' : 'bg-accent'}`} style={{ width: `${foiz}%` }} />
          </div>
          {(m.toldirish?.qolgan.length ?? 0) > 0 && (
            <span className="text-[12px] text-ink-3">
              Qolgan: {m.toldirish!.qolgan.map((q) => QOLGAN_NOMI[q] ?? q).join(', ')}
              {m.toldirish!.majburiy_qolgan?.length ? ` · majburiy: ${m.toldirish!.majburiy_qolgan.map((q) => QOLGAN_NOMI[q] ?? q).join(', ')}` : ''}
            </span>
          )}
        </div>
        {p.holat === 'qaytarildi' && p.qaytarish_izoh && (
          <p className="rounded-[9px] border border-brand bg-brand-soft px-3 py-2 text-[13px]">
            <b>Manager qaytardi:</b> {p.qaytarish_izoh}
          </p>
        )}
        {p.holat === 'kutilmoqda' && !manager && (
          <p className="text-[12.5px] text-ink-3">CV dagi o‘zgarishlar manager tasdig‘ini kutyapti. Saytda hozircha oldingi tasdiqlangan nusxa turadi.</p>
        )}
      </Card>

      {/* ── Manager: tasdiq ── */}
      {manager && p.holat === 'kutilmoqda' && (
        <Card className="flex flex-col gap-3 px-5 py-4">
          <div className="flex items-baseline justify-between gap-3"><h2 className="font-[family-name:var(--font-display)] text-[15px] font-bold">Tasdiq kutilmoqda</h2>{p.ozgardi_vaqt && <span className="lbl">{vaqtFmt.format(new Date(p.ozgardi_vaqt))}</span>}</div>
          {farq.length === 0 ? (
            <p className="text-[12.5px] text-ink-3">Saytdagi nusxadan farq yo‘q (faqat ichki maydonlar o‘zgargan bo‘lishi mumkin).</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line-soft rounded-[10px] border border-line">
              {farq.map((f) => (
                <li key={f.nom} className="grid grid-cols-1 gap-1 px-3 py-2.5 text-[12.5px] sm:grid-cols-[130px_1fr_1fr] sm:gap-3">
                  <span className="font-semibold">{f.nom}</span>
                  <span className="text-ink-3 line-through decoration-ink-4">{f.eski}</span>
                  <span className="text-ink">{f.yangi}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <form action={cvTasdiqla}>
              <Yashirin teacherId={tid} qaytish={qaytish} />
              <Yuborish tur="ok" kutish="…">Tasdiqlash</Yuborish>
            </form>
            <form action={cvQaytar} className="flex flex-1 flex-wrap items-end gap-2">
              <Yashirin teacherId={tid} qaytish={qaytish} />
              <Maydon nom="Qaytarish sababi" className="min-w-[200px] flex-1">
                <input name="izoh" required placeholder="Masalan: sertifikat nusxasini yuklang" className={kirishKlass} />
              </Maydon>
              <Yuborish tur="xavfli" kutish="…">Qaytarish</Yuborish>
            </form>
          </div>
        </Card>
      )}

      {/* ── Admin: saytda ko'rsatish ── */}
      {admin && (
        <Card className="flex flex-col">
          <CardHeader title="Saytda ko‘rsatish" meta="faqat admin" />
          <form action={korinishSaqla} className="flex flex-col gap-3 px-5 pb-5">
            <Yashirin teacherId={tid} qaytish={qaytish} />
            <label className="flex min-h-11 items-center gap-2 text-[13.5px] font-semibold">
              <input type="checkbox" name="saytda" value="1" defaultChecked={p.saytda} className="size-4" />
              Saytda ko‘rsatish (bosh sahifa «Ustozlarimiz» va alohida sahifa)
            </label>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {KORINISH_MAYDONLARI.map(([k, nom]) => (
                <label key={k} className="flex min-h-11 items-center gap-2 text-[13px] text-ink-2">
                  <input type="checkbox" name={`k_${k}`} value="1" defaultChecked={Boolean(p.korinish?.[k])} className="size-4" />
                  {nom}
                </label>
              ))}
            </div>
            {(m.sertifikatlar.length > 0 || m.yutuqlar.length > 0) && (
              <div className="flex flex-col gap-1 rounded-[9px] border border-line-soft px-3 py-2">
                <span className="lbl">Har biri alohida</span>
                {m.sertifikatlar.map((s) => (
                  <div key={`s${s.id}`} className="flex flex-wrap items-center gap-x-4 text-[12.5px]">
                    <input type="hidden" name="s_id" value={s.id} />
                    <span className="min-w-[160px] font-semibold">{s.turi}{s.ball ? ` ${s.ball}` : ''}</span>
                    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name={`s_saytda_${s.id}`} value="1" defaultChecked={s.saytda} className="size-4" />saytda</label>
                    {s.fayl_yol && <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name={`s_fayl_${s.id}`} value="1" defaultChecked={s.fayl_saytda} className="size-4" />nusxasi ham</label>}
                  </div>
                ))}
                {m.yutuqlar.map((y) => (
                  <div key={`y${y.id}`} className="flex flex-wrap items-center gap-x-4 text-[12.5px]">
                    <input type="hidden" name="y_id" value={y.id} />
                    <span className="min-w-[160px] font-semibold">{y.nomi}</span>
                    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name={`y_saytda_${y.id}`} value="1" defaultChecked={y.saytda} className="size-4" />saytda</label>
                    {y.fayl_yol && <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name={`y_fayl_${y.id}`} value="1" defaultChecked={y.fayl_saytda} className="size-4" />fayli ham</label>}
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <Maydon nom="Tartib" izoh="Kichigi oldinda">
                <input name="sayt_tartib" inputMode="numeric" defaultValue={p.sayt_tartib} className={`${kirishKlass} w-28`} />
              </Maydon>
              <Yuborish kutish="…">Saqlash</Yuborish>
            </div>
            {p.saytda && !p.ommaviy && <p className="text-[12px] text-accent">Yoqildi, lekin hali tasdiqlangan nusxa yo‘q — manager tasdiqlagach saytda chiqadi.</p>}
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* ══ CV ══ */}
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col">
            <CardHeader title="CV — asosiy" meta="tasdiq bilan" />
            <form action={asosiySaqla} className="flex flex-col gap-3 px-5 pb-5">
              <Yashirin teacherId={tid} qaytish={qaytish} />
              <FaylYuklash nom="rasm_yol" teacherId={tid} bucket="ustoz-rasm" papka="rasm" rasm yorliq="Rasm *" joriy={p.rasm_yol} joriyHavola={p.rasm_yol ? m.havola[p.rasm_yol] : null} />
              <Maydon nom="Men haqimda" izoh="1500 belgigacha. Saytda ko‘rinadi.">
                <textarea name="tavsif" rows={4} maxLength={1500} defaultValue={p.tavsif ?? ''} className={`${kirishKlass} py-2`} />
              </Maydon>
              <Maydon nom="Fanlar *" izoh="Vergul bilan: Ingliz tili, IELTS">
                <input name="fanlar" defaultValue={p.fanlar.join(', ')} className={kirishKlass} />
              </Maydon>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Maydon nom="Nechanchi yildan dars beradi">
                  <input name="dars_boshlagan_yil" inputMode="numeric" placeholder="2019" defaultValue={p.dars_boshlagan_yil ?? ''} className={kirishKlass} />
                </Maydon>
                <Maydon nom="Biladigan tillar" izoh="Vergul bilan">
                  <input name="tillar" placeholder="O‘zbek, Ingliz, Rus" defaultValue={p.tillar.join(', ')} className={kirishKlass} />
                </Maydon>
              </div>
              <div>
                <Yuborish kutish="…">Saqlash</Yuborish>
              </div>
            </form>
          </Card>

          <RoyxatKarta title="Sertifikatlar" bosh="+ Sertifikat qo‘shish" bosmi={m.sertifikatlar.length === 0}>
            {m.sertifikatlar.map((s) => (
              <Qator key={s.id} sarlavha={`${s.turi}${s.ball ? ` · ${s.ball}` : ''}`} izoh={[s.qayerda, s.sana ? sana(s.sana) : null, s.muddat ? `${sana(s.muddat)} gacha` : null].filter(Boolean).join(' · ')} havola={s.fayl_yol ? m.havola[s.fayl_yol] : undefined}>
                <SertifikatForma tid={tid} qaytish={qaytish} s={s} havola={m.havola} />
                <OchirishTugma teacherId={tid} qaytish={qaytish} tur="sertifikat" id={s.id} />
              </Qator>
            ))}
            <SertifikatForma tid={tid} qaytish={qaytish} havola={m.havola} />
          </RoyxatKarta>

          <RoyxatKarta title="Yutuqlar" bosh="+ Yutuq qo‘shish" bosmi={m.yutuqlar.length === 0}>
            {m.yutuqlar.map((y) => (
              <Qator key={y.id} sarlavha={y.nomi} izoh={[y.sana ? sana(y.sana) : null, y.izoh].filter(Boolean).join(' · ')} havola={y.fayl_yol ? m.havola[y.fayl_yol] : undefined}>
                <YutuqForma tid={tid} qaytish={qaytish} y={y} havola={m.havola} />
                <OchirishTugma teacherId={tid} qaytish={qaytish} tur="yutuq" id={y.id} />
              </Qator>
            ))}
            <YutuqForma tid={tid} qaytish={qaytish} havola={m.havola} />
          </RoyxatKarta>

          <RoyxatKarta title="Ta’lim *" bosh="+ Ta’lim qo‘shish" bosmi={m.talim.length === 0}>
            {m.talim.map((t) => (
              <Qator
                key={t.id}
                sarlavha={t.otm}
                izoh={[t.yonalish, t.daraja ? DARAJA_NOMI[t.daraja] : null, `${t.dan_yil ?? '?'} – ${t.oqiyapti ? 'hozir' : (t.gacha_yil ?? '?')}`].filter(Boolean).join(' · ')}
                havola={t.diplom_yol ? m.havola[t.diplom_yol] : undefined}
              >
                <TalimForma tid={tid} qaytish={qaytish} t={t} havola={m.havola} />
                <OchirishTugma teacherId={tid} qaytish={qaytish} tur="talim" id={t.id} />
              </Qator>
            ))}
            <TalimForma tid={tid} qaytish={qaytish} havola={m.havola} />
          </RoyxatKarta>
        </div>

        {/* ══ Obyektivka ══ */}
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col">
            <CardHeader title="Obyektivka — shaxsiy" meta="ichki · darhol saqlanadi" />
            <form action={shaxsiySaqla} className="flex flex-col gap-3 px-5 pb-5">
              <Yashirin teacherId={tid} qaytish={qaytish} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Maydon nom="Tug‘ilgan sana *">
                  <SanaKiritish name="tugilgan_sana" defaultValue={sh?.tugilgan_sana ?? ''} max={`${yil - 14}-12-31`} className={kirishKlass} />
                </Maydon>
                <Maydon nom="Tug‘ilgan joyi">
                  <input name="tugilgan_joy" placeholder="Toshkent sh." defaultValue={sh?.tugilgan_joy ?? ''} className={kirishKlass} />
                </Maydon>
                <Maydon nom="Millati">
                  <input name="millati" defaultValue={sh?.millati ?? ''} className={kirishKlass} />
                </Maydon>
                <Maydon nom="Ma’lumoti">
                  <select name="malumoti" defaultValue={sh?.malumoti ?? ''} className={kirishKlass}>
                    <option value="">—</option>
                    {Object.entries(MALUMOTI_NOMI).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Maydon>
                <Maydon nom="Ma’lumoti bo‘yicha mutaxassisligi" className="sm:col-span-2">
                  <input name="mutaxassisligi" defaultValue={sh?.mutaxassisligi ?? ''} className={kirishKlass} />
                </Maydon>
                <Maydon nom="Ilmiy darajasi">
                  <input name="ilmiy_daraja" placeholder="yo‘q" defaultValue={sh?.ilmiy_daraja ?? ''} className={kirishKlass} />
                </Maydon>
                <Maydon nom="Ilmiy unvoni">
                  <input name="ilmiy_unvon" placeholder="yo‘q" defaultValue={sh?.ilmiy_unvon ?? ''} className={kirishKlass} />
                </Maydon>
                <Maydon nom="Qaysi chet tillarini biladi" className="sm:col-span-2">
                  <input name="chet_tillari" placeholder="ingliz (C1), rus" defaultValue={sh?.chet_tillari ?? ''} className={kirishKlass} />
                </Maydon>
                <Maydon nom="Davlat mukofotlari" className="sm:col-span-2">
                  <input name="mukofotlar" placeholder="yo‘q" defaultValue={sh?.mukofotlar ?? ''} className={kirishKlass} />
                </Maydon>
                <Maydon nom="Pasport (seriya, raqam)">
                  <input name="pasport" placeholder="AB1234567" defaultValue={sh?.pasport ?? ''} autoComplete="off" className={`${kirishKlass} uppercase`} />
                </Maydon>
                <Maydon nom="JSHSHIR (14 raqam)">
                  <input name="jshshir" inputMode="numeric" maxLength={14} defaultValue={sh?.jshshir ?? ''} autoComplete="off" className={kirishKlass} />
                </Maydon>
                <Maydon nom="Yashash manzili" className="sm:col-span-2">
                  <input name="manzil" defaultValue={sh?.manzil ?? ''} className={kirishKlass} />
                </Maydon>
              </div>
              <FaylYuklash nom="pasport_yol" teacherId={tid} bucket="ustoz-hujjat" papka="pasport" yorliq="Pasport nusxasi" joriy={sh?.pasport_yol} joriyHavola={sh?.pasport_yol ? m.havola[sh.pasport_yol] : null} />
              <p className="text-[11.5px] text-ink-3">Bu bo‘lim saytga chiqmaydi. Faqat siz va rahbariyat ko‘radi.</p>
              <div>
                <Yuborish kutish="…">Saqlash</Yuborish>
              </div>
            </form>
          </Card>

          <RoyxatKarta title="Mehnat faoliyati" bosh="+ Ish joyi qo‘shish" bosmi={m.mehnat.length === 0}>
            {m.mehnat.map((x) => (
              <Qator key={x.id} sarlavha={`${x.dan_yil} – ${x.gacha_yil ?? 'h.v.'}`} izoh={[x.ish_joyi, x.lavozim].filter(Boolean).join(' · ')}>
                <MehnatForma tid={tid} qaytish={qaytish} x={x} />
                <OchirishTugma teacherId={tid} qaytish={qaytish} tur="mehnat" id={x.id} />
              </Qator>
            ))}
            <MehnatForma tid={tid} qaytish={qaytish} />
          </RoyxatKarta>

          {/* ── Tarix ── */}
          <Card className="flex flex-col">
            <CardHeader title="O‘zgarishlar tarixi" meta={`${m.tarix.length} ta`} />
            {m.tarix.length === 0 ? (
              <div className="px-5 pb-5"><Empty>Hali o‘zgarish yo‘q.</Empty></div>
            ) : (
              <ul className="flex max-h-[420px] flex-col overflow-y-auto">
                {m.tarix.map((t) => (
                  <li key={t.id} className="flex flex-col gap-0.5 border-t border-line-soft px-5 py-2.5 text-[12.5px]">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge ton={t.kim_ustoz ? 'jim' : 'accent'}>{t.kim_ustoz ? 'ustoz' : (t.profiles?.ism ?? 'rahbariyat')}</Badge>
                      <span className="font-semibold">{JADVAL_BOLIM[t.jadval] ?? t.jadval}</span>
                      {t.maydon && <span className="text-ink-2">· {MAYDON_NOMI[t.maydon] ?? t.maydon}</span>}
                      <span className="ml-auto text-[11.5px] text-ink-4">{vaqtFmt.format(new Date(t.vaqt))}</span>
                    </span>
                    <span className="text-ink-3">
                      {t.amal === 'qoshildi' ? `qo‘shildi: ${t.yangi ?? ''}` : t.amal === 'ochirildi' ? `o‘chirildi: ${t.eski ?? ''}` : `${t.eski ?? '—'} → ${t.yangi ?? '—'}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

/* ───────── Kichik bo'laklar ───────── */

function RoyxatKarta({ title, bosh, bosmi, children }: { title: string; bosh: string; bosmi: boolean; children: React.ReactNode[] | React.ReactNode }) {
  const bolalar = Array.isArray(children) ? children : [children]
  const qatorlar = bolalar.slice(0, -1).flat()
  const yangi = bolalar[bolalar.length - 1]
  return (
    <Card className="flex flex-col">
      <CardHeader title={title} meta={bosmi ? 'bo‘sh' : `${(qatorlar as unknown[]).length} ta`} />
      <div className="flex flex-col gap-2 px-5 pb-4">
        {qatorlar}
        <details className="rounded-[10px] border border-dashed border-line px-4 py-3" open={bosmi}>
          <summary className="cursor-pointer text-[13px] font-semibold text-accent">{bosh}</summary>
          <div className="mt-3">{yangi}</div>
        </details>
      </div>
    </Card>
  )
}

function Qator({ sarlavha, izoh, havola, children }: { sarlavha: string; izoh?: string; havola?: string; children: React.ReactNode }) {
  return (
    <details className="rounded-[10px] border border-line px-4 py-2.5">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 flex-col">
          <span className="text-[13.5px] font-semibold">{sarlavha}</span>
          {izoh && <span className="text-[12px] text-ink-3">{izoh}</span>}
        </span>
        <span className="flex items-center gap-3 text-[12px]">
          {havola && (
            <a href={havola} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
              nusxa
            </a>
          )}
          <span className="text-ink-3">tahrirlash</span>
        </span>
      </summary>
      <div className="mt-3 flex flex-col gap-2">{children}</div>
    </details>
  )
}

function SertifikatForma({ tid, qaytish, s, havola }: { tid: string; qaytish: string; s?: Sertifikat; havola: Record<string, string> }) {
  return (
    <form action={sertifikatSaqla} className="flex flex-col gap-3">
      <Yashirin teacherId={tid} qaytish={qaytish} />
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Maydon nom="Turi">
          <select name="turi" required defaultValue={s?.turi ?? ''} className={kirishKlass}>
            <option value="" disabled>Tanlang…</option>
            {SERTIFIKAT_TURLARI.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
            {s && !(SERTIFIKAT_TURLARI as readonly string[]).includes(s.turi) && <option value={s.turi}>{s.turi}</option>}
          </select>
        </Maydon>
        <Maydon nom="Ball / daraja">
          <input name="ball" placeholder="8.0 · C1" defaultValue={s?.ball ?? ''} className={kirishKlass} />
        </Maydon>
        <Maydon nom="Qayerda topshirgan" className="sm:col-span-2">
          <input name="qayerda" placeholder="British Council, Toshkent" defaultValue={s?.qayerda ?? ''} className={kirishKlass} />
        </Maydon>
        <Maydon nom="Olingan sana">
          <SanaKiritish name="sana" defaultValue={s?.sana ?? ''} className={kirishKlass} />
        </Maydon>
        <Maydon nom="Amal qilish muddati" izoh="Bo‘sh — muddatsiz">
          <SanaKiritish name="muddat" defaultValue={s?.muddat ?? ''} className={kirishKlass} />
        </Maydon>
      </div>
      <FaylYuklash nom="fayl_yol" teacherId={tid} bucket="ustoz-hujjat" papka="sertifikat" yorliq="Sertifikat nusxasi" joriy={s?.fayl_yol} joriyHavola={s?.fayl_yol ? havola[s.fayl_yol] : null} />
      <div>
        <Yuborish kutish="…">{s ? 'Saqlash' : 'Qo‘shish'}</Yuborish>
      </div>
    </form>
  )
}

function YutuqForma({ tid, qaytish, y, havola }: { tid: string; qaytish: string; y?: Yutuq; havola: Record<string, string> }) {
  return (
    <form action={yutuqSaqla} className="flex flex-col gap-3">
      <Yashirin teacherId={tid} qaytish={qaytish} />
      {y && <input type="hidden" name="id" value={y.id} />}
      <Maydon nom="Nomi">
        <input name="nomi" required placeholder="O‘quvchim IELTS 8.0 oldi" defaultValue={y?.nomi ?? ''} className={kirishKlass} />
      </Maydon>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
        <Maydon nom="Sana">
          <SanaKiritish name="sana" defaultValue={y?.sana ?? ''} className={kirishKlass} />
        </Maydon>
        <Maydon nom="Izoh">
          <input name="izoh" defaultValue={y?.izoh ?? ''} className={kirishKlass} />
        </Maydon>
      </div>
      <FaylYuklash nom="fayl_yol" teacherId={tid} bucket="ustoz-hujjat" papka="yutuq" yorliq="Fayl (diplom, rasm, natija)" joriy={y?.fayl_yol} joriyHavola={y?.fayl_yol ? havola[y.fayl_yol] : null} />
      <div>
        <Yuborish kutish="…">{y ? 'Saqlash' : 'Qo‘shish'}</Yuborish>
      </div>
    </form>
  )
}

function TalimForma({ tid, qaytish, t, havola }: { tid: string; qaytish: string; t?: Talim; havola: Record<string, string> }) {
  return (
    <form action={talimSaqla} className="flex flex-col gap-3">
      <Yashirin teacherId={tid} qaytish={qaytish} />
      {t && <input type="hidden" name="id" value={t.id} />}
      <Maydon nom="O‘quv yurti">
        <input name="otm" required placeholder="O‘zbekiston davlat jahon tillari universiteti" defaultValue={t?.otm ?? ''} className={kirishKlass} />
      </Maydon>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Maydon nom="Yo‘nalish / fakultet">
          <input name="yonalish" defaultValue={t?.yonalish ?? ''} className={kirishKlass} />
        </Maydon>
        <Maydon nom="Daraja">
          <select name="daraja" defaultValue={t?.daraja ?? ''} className={kirishKlass}>
            <option value="">—</option>
            {Object.entries(DARAJA_NOMI).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Maydon>
        <Maydon nom="Boshlagan yil">
          <input name="dan_yil" inputMode="numeric" placeholder="2016" defaultValue={t?.dan_yil ?? ''} className={kirishKlass} />
        </Maydon>
        <Maydon nom="Bitirgan yil">
          <input name="gacha_yil" inputMode="numeric" placeholder="2020" defaultValue={t?.gacha_yil ?? ''} className={kirishKlass} />
        </Maydon>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-[13px] text-ink-2">
        <input type="checkbox" name="oqiyapti" value="1" defaultChecked={t?.oqiyapti ?? false} className="size-4" />
        Hozir o‘qiyapti
      </label>
      <FaylYuklash nom="diplom_yol" teacherId={tid} bucket="ustoz-hujjat" papka="diplom" yorliq="Diplom nusxasi" joriy={t?.diplom_yol} joriyHavola={t?.diplom_yol ? havola[t.diplom_yol] : null} />
      <div>
        <Yuborish kutish="…">{t ? 'Saqlash' : 'Qo‘shish'}</Yuborish>
      </div>
    </form>
  )
}

function MehnatForma({ tid, qaytish, x }: { tid: string; qaytish: string; x?: Mehnat }) {
  return (
    <form action={mehnatSaqla} className="flex flex-col gap-3">
      <Yashirin teacherId={tid} qaytish={qaytish} />
      {x && <input type="hidden" name="id" value={x.id} />}
      <div className="grid grid-cols-2 gap-3">
        <Maydon nom="Boshlagan yil">
          <input name="dan_yil" required inputMode="numeric" placeholder="2021" defaultValue={x?.dan_yil ?? ''} className={kirishKlass} />
        </Maydon>
        <Maydon nom="Tugagan yil" izoh="Bo‘sh — hozirgacha">
          <input name="gacha_yil" inputMode="numeric" defaultValue={x?.gacha_yil ?? ''} className={kirishKlass} />
        </Maydon>
      </div>
      <Maydon nom="Ish joyi">
        <input name="ish_joyi" required defaultValue={x?.ish_joyi ?? ''} className={kirishKlass} />
      </Maydon>
      <Maydon nom="Lavozimi">
        <input name="lavozim" defaultValue={x?.lavozim ?? ''} className={kirishKlass} />
      </Maydon>
      <div>
        <Yuborish kutish="…">{x ? 'Saqlash' : 'Qo‘shish'}</Yuborish>
      </div>
    </form>
  )
}
