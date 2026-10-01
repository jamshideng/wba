'use client'

import { useState } from 'react'
import { kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { BTURLAR, variantlarniOqi, type BildirishnomaTuri } from '@/lib/bildirishnoma'
import { KIMLAR } from '@/lib/elon'
import { bildirishnomaYarat } from './actions'
import { BildirishnomaKarta } from '@/components/bildirishnomalar'

function Maydon({ nom, izoh, children }: { nom: string; izoh?: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="lbl">{nom}</span>
      {children}
      {izoh && <span className="text-[11.5px] leading-snug text-ink-3">{izoh}</span>}
    </label>
  )
}

/** Yangi bildirishnoma: turini tanlash, kimga, muddat; o'ngda — foydalanuvchi ko'radigan ko'rinish */
export function BildirishnomaForma({
  guruhlar, fanlar,
}: { guruhlar: { id: string; nom: string }[]; fanlar: [string, string][] }) {
  const [turi, setTuri] = useState<BildirishnomaTuri>('eslatma')
  const [sarlavha, setSarlavha] = useState('')
  const [matn, setMatn] = useState('')
  const [variantlar, setVariantlar] = useState('Ha\nYo‘q')
  const [havolaMatn, setHavolaMatn] = useState('')
  const [muhim, setMuhim] = useState(false)
  const [kop, setKop] = useState(false)

  const sorov = turi === 'sorovnoma'
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
      <form action={bildirishnomaYarat} className="flex flex-col gap-4">
        <input type="hidden" name="turi" value={turi} />
        <fieldset className="flex flex-col gap-2">
          <legend className="lbl mb-1.5">Turi</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BTURLAR.map((t) => (
              <button
                key={t.qiymat}
                type="button"
                aria-pressed={turi === t.qiymat}
                onClick={() => setTuri(t.qiymat)}
                className={`flex min-h-11 flex-col items-start gap-0.5 rounded-[10px] border px-3 py-2 text-left transition ${
                  turi === t.qiymat ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-ink-3'
                }`}
              >
                <span className="text-[13px] font-bold text-ink">{t.nom}</span>
              </button>
            ))}
          </div>
          <span className="text-[11.5px] text-ink-3">{BTURLAR.find((t) => t.qiymat === turi)?.izoh}</span>
        </fieldset>

        <Maydon nom={sorov ? 'Savol' : 'Sarlavha'}>
          <input name="sarlavha" required maxLength={120} value={sarlavha} onChange={(e) => setSarlavha(e.target.value)}
            placeholder={sorov ? 'Masalan: Shanba kuni qo‘shimcha dars kerakmi?' : 'Masalan: 5-oktabr — dam olish kuni'} className={kirishKlass} />
        </Maydon>
        <Maydon nom="Matn" izoh="Ixtiyoriy, 2000 belgigacha">
          <textarea name="matn" rows={3} maxLength={2000} value={matn} onChange={(e) => setMatn(e.target.value)} className={`${kirishKlass} py-2.5`} />
        </Maydon>

        {sorov && (
          <div className="flex flex-col gap-3 rounded-[12px] border border-accent-line bg-accent-soft p-3.5">
            <Maydon nom="Variantlar" izoh="Har qatorga bittadan, 2–10 ta">
              <textarea name="variantlar" rows={4} value={variantlar} onChange={(e) => setVariantlar(e.target.value)} className={`${kirishKlass} py-2.5`} />
            </Maydon>
            <label className="flex items-center gap-2.5 text-[13px] text-ink-2">
              <input type="checkbox" name="kop_tanlov" value="1" checked={kop} onChange={(e) => setKop(e.target.checked)} className="size-5 accent-brand" />
              Bir nechta variant tanlasa bo‘ladi
            </label>
            <label className="flex items-center gap-2.5 text-[13px] text-ink-2">
              <input type="checkbox" name="natija_ochiq" value="1" defaultChecked className="size-5 accent-brand" />
              Ovoz bergan odam natijani ko‘rsin
            </label>
          </div>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="lbl mb-1.5">Kimga ko‘rinsin</legend>
          <div className="flex flex-wrap gap-2">
            {KIMLAR.map((k) => (
              <label key={k.qiymat} className="flex min-h-11 items-center gap-2 rounded-[9px] border border-line bg-surface px-3 text-[13px]">
                <input type="checkbox" name="k" value={k.qiymat} defaultChecked={k.qiymat === 'oquvchi'} className="size-4 accent-brand" />
                {k.nom}
              </label>
            ))}
          </div>
        </fieldset>

        <Maydon nom="Kimlar orasidan" izoh="O‘quvchi va ota-onaga — guruh/fan/qarz bo‘yicha; ustozga — guruh/fan bo‘yicha">
          <select name="f" defaultValue="hammasi" className={kirishKlass}>
            <option value="hammasi">Hammasi</option>
            <option value="qarzdor">Faqat qarzdorlar</option>
            <optgroup label="Fan">
              {fanlar.map(([id, nom]) => <option key={id} value={`fan:${id}`}>{nom}</option>)}
            </optgroup>
            <optgroup label="Guruh">
              {guruhlar.map((g) => <option key={g.id} value={`guruh:${g.id}`}>{g.nom}</option>)}
            </optgroup>
          </select>
        </Maydon>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Maydon nom="Tugma matni" izoh="Ixtiyoriy, masalan: Batafsil">
            <input name="havola_matn" maxLength={40} value={havolaMatn} onChange={(e) => setHavolaMatn(e.target.value)} className={kirishKlass} />
          </Maydon>
          <Maydon nom="Tugma havolasi" izoh="/crm/market yoki https://…">
            <input name="havola" maxLength={300} placeholder="/crm/market" className={kirishKlass} />
          </Maydon>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Maydon nom="Qachondan" izoh="Bo‘sh — hozirdan">
            <input name="boshlanish" type="datetime-local" className={kirishKlass} />
          </Maydon>
          <Maydon nom="Qachongacha" izoh="Bo‘sh — o‘zingiz yopguningizcha">
            <input name="tugash" type="datetime-local" className={kirishKlass} />
          </Maydon>
        </div>

        <label className="flex items-start gap-2.5 rounded-[10px] border border-line bg-surface px-3.5 py-3 text-[13px] text-ink-2">
          <input type="checkbox" name="muhim" value="1" checked={muhim} onChange={(e) => setMuhim(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-brand" />
          <span>
            <b className="text-ink">Muhim</b> — ekran o‘rtasida chiqadi va o‘zi yopilmaydi
            {sorov ? ' (javob bermaguncha qayta chiqadi)' : ' (o‘qib yopguncha qayta chiqadi)'}
          </span>
        </label>

        <Yuborish>E’lon qilish</Yuborish>
      </form>

      <div className="flex flex-col gap-2 lg:sticky lg:top-20">
        <span className="lbl">Foydalanuvchi shunday ko‘radi</span>
        <div className="rounded-[14px] border border-dashed border-line bg-surface-2/50 p-4">
          <BildirishnomaKarta
            namuna
            b={{
              id: 0, turi, sarlavha: sarlavha || (sorov ? 'Savol' : 'Sarlavha'), matn: matn || null,
              havola: havolaMatn ? '#' : null, havola_matn: havolaMatn || null, muhim, kop_tanlov: kop, natija_ochiq: true,
              created_at: new Date().toISOString(), korilgan: false, yopilgan: false, javob_berdim: false,
              variantlar: sorov ? variantlarniOqi(variantlar).map((m, i) => ({ id: -(i + 1), matn: m })) : [],
            }}
          />
        </div>
      </div>
    </div>
  )
}
