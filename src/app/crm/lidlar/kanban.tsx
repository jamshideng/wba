'use client'

/**
 * Lidlar kanbani. Kartani sudrab boshqa ustunga tashlash mumkin
 * (kompyuterda); telefonda — kartadagi "Bosqich" tanlovi.
 *
 * Har o'zgarish oddiy server action formasi orqali ketadi (redirect +
 * ?ok=...), shuning uchun natija xabari boshqa sahifalardagidek chiqadi.
 * Oynalar — <dialog>: Escape bilan yopiladi, fokus ichida qoladi.
 */

import { useEffect, useRef, useState } from 'react'
import { Yuborish } from '@/components/yuborish'
import { Maydon, kirishKlass } from '@/components/forma'
import { IconPhone, IconSend } from '@/components/icons'
import { bosqichi, kunQosh, MANBA_NOMI, type Bosqich, type LidKarta } from '@/lib/lidlar'
import { izohniAjrat } from '@/lib/ariza-izoh'
import { lidBosqich, lidBoglanildi, lidOquvchi, lidSaqla } from './actions'

type Guruh = { id: string; nom: string }
type Oyna =
  | { tur: 'bosqich'; lid: LidKarta; bosqich: Bosqich }
  | { tur: 'aloqa'; lid: LidKarta; kanal: 'telefon' | 'telegram' }
  | { tur: 'tahrir'; lid: LidKarta }
  | null

function sanaKorinish(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y.slice(2)}`
}

function telKorinish(t: string): string {
  const r = t.replace(/\D/g, '')
  return r.length === 12 ? `+${r.slice(0, 3)} ${r.slice(3, 5)} ${r.slice(5, 8)} ${r.slice(8, 10)} ${r.slice(10)}` : t
}

export function Kanban({
  lidlar,
  bosqichlar,
  guruhlar,
  bugun,
  yol,
}: {
  lidlar: LidKarta[]
  bosqichlar: { id: Bosqich; nom: string; izoh: string; rang: string }[]
  guruhlar: Guruh[]
  bugun: string
  yol: string
}) {
  const [oyna, setOyna] = useState<Oyna>(null)
  const [ustida, setUstida] = useState<Bosqich | null>(null)
  const [sudralmoqda, setSudralmoqda] = useState<string | null>(null)
  const tezForma = useRef<HTMLFormElement>(null)
  const [tez, setTez] = useState<{ id: string; bosqich: Bosqich } | null>(null)

  // "Yangi" va "Bog'lanildi" ga o'tkazish — oynasiz, darhol
  useEffect(() => {
    if (tez) tezForma.current?.requestSubmit()
  }, [tez])

  function otkaz(lid: LidKarta, bosqich: Bosqich) {
    if (bosqichi(lid) === bosqich) return
    if (lid.student_id) return
    if (bosqich === 'yangi' || bosqich === 'boglanildi') setTez({ id: lid.id, bosqich })
    else setOyna({ tur: 'bosqich', lid, bosqich })
  }

  const ustun = (b: Bosqich) => lidlar.filter((l) => bosqichi(l) === b)

  return (
    <>
      <form ref={tezForma} action={lidBosqich} className="hidden">
        <input type="hidden" name="qaytish" value={yol} />
        <input type="hidden" name="id" value={tez?.id ?? ''} />
        <input type="hidden" name="bosqich" value={tez?.bosqich ?? ''} />
      </form>

      <div className="-mx-5 overflow-x-auto px-5 pb-2 lg:-mx-7 lg:px-7">
        <div className="grid min-w-max auto-cols-[minmax(250px,1fr)] grid-flow-col gap-3 lg:min-w-0 lg:auto-cols-[minmax(200px,1fr)]">
          {bosqichlar.map((b) => {
            const kartalar = ustun(b.id)
            return (
              <section
                key={b.id}
                aria-label={b.nom}
                onDragOver={(e) => {
                  if (!sudralmoqda) return
                  e.preventDefault()
                  setUstida(b.id)
                }}
                onDragLeave={() => setUstida((u) => (u === b.id ? null : u))}
                onDrop={(e) => {
                  e.preventDefault()
                  setUstida(null)
                  const lid = lidlar.find((l) => l.id === e.dataTransfer.getData('text/plain'))
                  if (lid) otkaz(lid, b.id)
                }}
                className={`flex min-h-64 w-[260px] flex-col gap-2 rounded-[12px] border bg-surface-2/50 p-2.5 transition lg:w-auto ${
                  ustida === b.id ? 'border-brand bg-brand-soft/40' : 'border-line'
                }`}
              >
                <header className="flex items-center gap-2 px-1.5 pt-1 pb-1.5">
                  <span className={`block size-2 rounded-full ${b.rang}`} />
                  <h2 className="flex-1 font-[family-name:var(--font-display)] text-[14px] font-bold">{b.nom}</h2>
                  <span className="tnum rounded-md bg-surface px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] text-ink-3">
                    {kartalar.length}
                  </span>
                </header>
                {kartalar.length === 0 ? (
                  <p className="rounded-[10px] border border-dashed border-line px-3 py-6 text-center text-[12px] leading-relaxed text-ink-3">
                    {b.izoh}
                    <br />
                    Bu yerga hozircha hech kim yo‘q.
                  </p>
                ) : (
                  kartalar.map((l) => (
                    <Karta
                      key={l.id}
                      lid={l}
                      bugun={bugun}
                      bosqichlar={bosqichlar}
                      sudralmoqda={sudralmoqda === l.id}
                      onSudrash={setSudralmoqda}
                      onBosqich={(x) => otkaz(l, x)}
                      onAloqa={(kanal) => setOyna({ tur: 'aloqa', lid: l, kanal })}
                      onTahrir={() => setOyna({ tur: 'tahrir', lid: l })}
                    />
                  ))
                )}
              </section>
            )
          })}
        </div>
      </div>

      <Oynalar oyna={oyna} yop={() => setOyna(null)} guruhlar={guruhlar} bugun={bugun} yol={yol} />
    </>
  )
}

function Karta({
  lid,
  bugun,
  bosqichlar,
  sudralmoqda,
  onSudrash,
  onBosqich,
  onAloqa,
  onTahrir,
}: {
  lid: LidKarta
  bugun: string
  bosqichlar: { id: Bosqich; nom: string }[]
  sudralmoqda: boolean
  onSudrash: (id: string | null) => void
  onBosqich: (b: Bosqich) => void
  onAloqa: (kanal: 'telefon' | 'telegram') => void
  onTahrir: () => void
}) {
  const b = bosqichi(lid)
  const yopiq = b === 'oquvchi' || b === 'yoqotildi'
  const aloqa = lid.keyingi_aloqa
  const aloqaTon = !aloqa || yopiq ? '' : aloqa < bugun ? 'text-brand' : aloqa === bugun ? 'text-accent' : 'text-ink-3'
  const ariza = izohniAjrat(lid.izoh)
  const aloqaMatn = !aloqa ? null : aloqa < bugun ? `Kechikdi · ${sanaKorinish(aloqa)}` : aloqa === bugun ? 'Bugun bog‘lanish' : `Aloqa · ${sanaKorinish(aloqa)}`

  return (
    <article
      draggable={!yopiq}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', lid.id)
        e.dataTransfer.effectAllowed = 'move'
        onSudrash(lid.id)
      }}
      onDragEnd={() => onSudrash(null)}
      className={`flex flex-col gap-2 rounded-[10px] border border-line bg-surface p-3 shadow-sm transition ${
        yopiq ? '' : 'cursor-grab active:cursor-grabbing'
      } ${sudralmoqda ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onTahrir} className="min-w-0 text-left text-[13.5px] leading-snug font-semibold hover:underline">
          {lid.ism}
        </button>
        {lid.aloqa_soni > 0 && (
          <span title="Necha marta bog‘lanildi" className="tnum shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10.5px] text-ink-3">
            {lid.aloqa_soni}×
          </span>
        )}
      </div>

      <a href={`tel:${lid.telefon}`} className="flex items-center gap-1.5 text-[12.5px] text-ink-2 hover:text-ink">
        <IconPhone size={14} /> {telKorinish(lid.telefon)}
      </a>

      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-ink-3">{MANBA_NOMI[lid.manba]}</span>
        {lid.sinov_sana && b === 'sinov' && (
          <span className="rounded-md bg-brand-soft px-1.5 py-0.5 font-semibold text-brand">
            Sinov · {sanaKorinish(lid.sinov_sana)}
            {lid.holat === 'keldi' ? ' · keldi' : ''}
          </span>
        )}
        {lid.guruh && <span className="max-w-full truncate rounded-md bg-surface-2 px-1.5 py-0.5 text-ink-3">{lid.guruh}</span>}
        {lid.teglar.map((t) => (
          <span key={t} className="rounded-md border border-line px-1.5 py-0.5 text-ink-3">#{t}</span>
        ))}
      </div>

      {aloqaMatn && !yopiq && <p className={`text-[12px] font-semibold ${aloqaTon}`}>{aloqaMatn}</p>}
      {/* Saytdagi arizadan: mini-test natijasi va qulay kun/vaqt — alohida belgilar */}
      {ariza.test && (
        <p className="flex items-center gap-2 rounded-[8px] bg-brand-soft px-2 py-1.5 text-[11.5px] leading-snug" title="Saytdagi mini-test natijasi">
          <span className="tnum shrink-0 rounded-md bg-brand px-1.5 py-0.5 font-bold text-white">
            {ariza.test.foiz ?? '—'}%
          </span>
          <span className="min-w-0 truncate font-semibold text-ink">Test · {ariza.test.matn}</span>
        </p>
      )}
      {ariza.vaqt && (
        <p className="rounded-[8px] border border-line px-2 py-1.5 text-[11.5px] font-semibold leading-snug text-ink-2" title="Arizada tanlangan qulay vaqt">
          {ariza.vaqt}
        </p>
      )}
      {ariza.qolgan && <p className="line-clamp-2 text-[12px] leading-snug whitespace-pre-line text-ink-3">{ariza.qolgan}</p>}
      {b === 'yoqotildi' && lid.sabab && (
        <p className="text-[12px] text-ink-3">
          {lid.holat === 'kelmadi' ? 'Kelmadi' : 'Rad etdi'}: {lid.sabab}
        </p>
      )}

      {!yopiq && (
        <div className="flex flex-col gap-1.5 border-t border-line-soft pt-2">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onAloqa('telefon')}
              title="Telefon orqali bog‘lanildi"
              className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-[8px] border border-line text-[12px] text-ink-2 hover:border-ink-3 hover:text-ink"
            >
              <IconPhone size={14} /> Bog‘lanildi
            </button>
            <button
              type="button"
              onClick={() => onAloqa('telegram')}
              title="Telegram orqali bog‘lanildi"
              aria-label="Telegram orqali bog‘lanildi"
              className="flex min-h-9 w-10 shrink-0 items-center justify-center rounded-[8px] border border-line text-ink-2 hover:border-ink-3 hover:text-ink"
            >
              <IconSend size={14} />
            </button>
          </div>
          <label>
            <span className="sr-only">Bosqichni o‘zgartirish</span>
            <select
              value=""
              onChange={(e) => e.target.value && onBosqich(e.target.value as Bosqich)}
              className="min-h-9 w-full rounded-[8px] border border-line bg-surface px-2 text-[12px] text-ink-2"
            >
              <option value="">Boshqa bosqichga…</option>
              {bosqichlar
                .filter((x) => x.id !== b)
                .map((x) => (
                  <option key={x.id} value={x.id}>→ {x.nom}</option>
                ))}
            </select>
          </label>
        </div>
      )}
    </article>
  )
}

function Oynalar({
  oyna,
  yop,
  guruhlar,
  bugun,
  yol,
}: {
  oyna: Oyna
  yop: () => void
  guruhlar: Guruh[]
  bugun: string
  yol: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (oyna && !d.open) d.showModal()
    if (!oyna && d.open) d.close()
  }, [oyna])

  const ertaga = kunQosh(bugun, 1)
  let sarlavha = ''
  let ichi: React.ReactNode = null

  if (oyna?.tur === 'bosqich' && oyna.bosqich === 'sinov') {
    sarlavha = `Sinov darsi — ${oyna.lid.ism}`
    ichi = (
      <form action={lidBosqich} className="flex flex-col gap-3">
        <Yashirin yol={yol} id={oyna.lid.id} />
        <input type="hidden" name="bosqich" value="sinov" />
        <Maydon nom="Sinov darsi kuni">
          <input name="sinov_sana" type="date" required min={bugun} defaultValue={oyna.lid.sinov_sana ?? ertaga} className={kirishKlass} />
        </Maydon>
        <Maydon nom="Guruh" izoh="Keyin o‘quvchi qilish uchun kerak bo‘ladi">
          <select name="group_id" defaultValue={oyna.lid.group_id ?? ''} className={kirishKlass}>
            <option value="">Hali tanlanmagan</option>
            {guruhlar.map((g) => (
              <option key={g.id} value={g.id}>{g.nom}</option>
            ))}
          </select>
        </Maydon>
        <Maydon nom="Izoh">
          <input name="sabab" maxLength={200} placeholder="Masalan: dushanba 14:00 ga keladi" className={kirishKlass} />
        </Maydon>
        <Tugmalar yop={yop}>Sinovga yozish</Tugmalar>
      </form>
    )
  } else if (oyna?.tur === 'bosqich' && oyna.bosqich === 'oquvchi') {
    sarlavha = `O‘quvchi qilish — ${oyna.lid.ism}`
    ichi = (
      <form action={lidOquvchi} className="flex flex-col gap-3">
        <Yashirin yol={yol} id={oyna.lid.id} />
        <p className="text-[12.5px] leading-relaxed text-ink-3">
          O‘quvchilar ro‘yxatiga qo‘shiladi va tanlangan guruhga yoziladi. Hisob-faktura guruh narxidan avtomatik chiqadi.
        </p>
        <Maydon nom="Guruh">
          <select name="group_id" required defaultValue={oyna.lid.group_id ?? ''} className={kirishKlass}>
            <option value="" disabled>Guruhni tanlang</option>
            {guruhlar.map((g) => (
              <option key={g.id} value={g.id}>{g.nom}</option>
            ))}
          </select>
        </Maydon>
        <Maydon nom="Boshlagan sana">
          <input name="boshlandi" type="date" defaultValue={bugun} className={kirishKlass} />
        </Maydon>
        <Tugmalar yop={yop}>O‘quvchi qilish</Tugmalar>
      </form>
    )
  } else if (oyna?.tur === 'bosqich' && oyna.bosqich === 'yoqotildi') {
    sarlavha = `Yo‘qotildi — ${oyna.lid.ism}`
    ichi = (
      <form action={lidBosqich} className="flex flex-col gap-3">
        <Yashirin yol={yol} id={oyna.lid.id} />
        <input type="hidden" name="bosqich" value="yoqotildi" />
        <Maydon nom="Nima bo‘ldi">
          <select name="holat" defaultValue={oyna.lid.sinov_sana ? 'kelmadi' : 'rad'} className={kirishKlass}>
            <option value="rad">Rad etdi</option>
            <option value="kelmadi">Sinov darsiga kelmadi</option>
          </select>
        </Maydon>
        <Maydon nom="Sabab" izoh="Hisobot uchun: narx, vaqt, masofa…">
          <input name="sabab" required maxLength={200} className={kirishKlass} />
        </Maydon>
        <Tugmalar yop={yop} tur="xavfli">Yo‘qotildi deb belgilash</Tugmalar>
      </form>
    )
  } else if (oyna?.tur === 'aloqa') {
    sarlavha = `${oyna.kanal === 'telegram' ? 'Telegram' : 'Telefon'} orqali bog‘lanildi — ${oyna.lid.ism}`
    ichi = (
      <form action={lidBoglanildi} className="flex flex-col gap-3">
        <Yashirin yol={yol} id={oyna.lid.id} />
        <input type="hidden" name="kanal" value={oyna.kanal} />
        <Maydon nom="Natija">
          <input name="izoh" maxLength={300} placeholder="Masalan: narxni so‘radi, ertaga javob beradi" className={kirishKlass} />
        </Maydon>
        <Maydon nom="Keyingi aloqa" izoh="Bo‘sh qoldirilsa eslatma qo‘yilmaydi">
          <input name="keyingi_aloqa" type="date" min={bugun} defaultValue={kunQosh(bugun, 2)} className={kirishKlass} />
        </Maydon>
        <Tugmalar yop={yop}>Yozib qo‘yish</Tugmalar>
      </form>
    )
  } else if (oyna?.tur === 'tahrir') {
    const l = oyna.lid
    sarlavha = 'Lidni tahrirlash'
    ichi = (
      <form action={lidSaqla} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Yashirin yol={yol} id={l.id} />
        <Maydon nom="Ism familya">
          <input name="ism" required maxLength={100} defaultValue={l.ism} className={kirishKlass} />
        </Maydon>
        <Maydon nom="Telefon">
          <input name="telefon" type="tel" required defaultValue={l.telefon} className={kirishKlass} />
        </Maydon>
        <Maydon nom="Qayerdan bildi">
          <select name="manba" defaultValue={l.manba} className={kirishKlass}>
            {Object.entries(MANBA_NOMI).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Maydon>
        <Maydon nom="Keyingi aloqa">
          <input name="keyingi_aloqa" type="date" defaultValue={l.keyingi_aloqa ?? ''} className={kirishKlass} />
        </Maydon>
        <Maydon nom="Teglar" izoh="Vergul bilan" className="sm:col-span-2">
          <input name="teglar" maxLength={200} defaultValue={l.teglar.join(', ')} className={kirishKlass} />
        </Maydon>
        <Maydon nom="Izoh" className="sm:col-span-2">
          <textarea name="izoh" rows={4} maxLength={1000} defaultValue={l.izoh ?? ''} className={`${kirishKlass} py-2`} />
        </Maydon>
        {l.oxirgi_aloqa && (
          <p className="text-[12px] text-ink-3 sm:col-span-2">
            Oxirgi aloqa: {new Date(l.oxirgi_aloqa).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', dateStyle: 'short', timeStyle: 'short' })} · jami {l.aloqa_soni} marta
          </p>
        )}
        <div className="sm:col-span-2">
          <Tugmalar yop={yop}>Saqlash</Tugmalar>
        </div>
      </form>
    )
  }

  return (
    <dialog
      ref={ref}
      onClose={yop}
      onClick={(e) => e.target === e.currentTarget && yop()}
      className="m-auto w-[min(520px,calc(100vw-24px))] rounded-[14px] border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50"
    >
      {oyna && (
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-[16px] font-bold">{sarlavha}</h2>
            <button type="button" onClick={yop} aria-label="Yopish" className="-mt-1 -mr-1 flex size-9 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink">
              ×
            </button>
          </div>
          {ichi}
        </div>
      )}
    </dialog>
  )
}

function Yashirin({ yol, id }: { yol: string; id: string }) {
  return (
    <>
      <input type="hidden" name="qaytish" value={yol} />
      <input type="hidden" name="id" value={id} />
    </>
  )
}

function Tugmalar({ yop, children, tur = 'asosiy' }: { yop: () => void; children: React.ReactNode; tur?: 'asosiy' | 'xavfli' }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={yop} className="min-h-11 rounded-[9px] border border-line px-4 text-[13px] text-ink-2 hover:border-ink-3 hover:text-ink">
        Bekor qilish
      </button>
      <Yuborish tur={tur}>{children}</Yuborish>
    </div>
  )
}
