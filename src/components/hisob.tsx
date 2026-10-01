import { randomBytes } from 'node:crypto'
import { Badge } from '@/components/ui'
import { Maydon, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { hisobOch } from '@/app/crm/hisoblar/actions'
import { loginNomi } from '@/lib/login'

/** Tavsiya etiladigan parol. Admin uni ko'rib turadi va o'quvchiga aytadi. */
function tavsiyaParol(): string {
  return randomBytes(6).toString('base64url')
}

/**
 * Hisob ochish / parolni almashtirish.
 *
 * Parol formada tayyor turadi — admin uni nusxalab o'quvchiga beradi.
 * Ataylab manzilga (?parol=…) chiqarilmaydi: u brauzer tarixida va
 * server jurnalida qolib ketardi.
 */
export function HisobForma({
  turi,
  nishon,
  ism,
  bormi,
  email,
}: {
  turi: 'oquvchi' | 'ustoz' | 'ota_ona'
  nishon: string
  ism: string
  bormi: boolean
  email?: string | null
}) {
  const otaOna = turi === 'ota_ona'
  const taklif = turi === 'oquvchi' ? nishon.toLowerCase() : otaOna ? `${nishon.toLowerCase()}-ota` : ''
  const sarlavha = otaOna
    ? bormi ? 'Ota-ona paroli' : 'Ota-ona hisobi ochish'
    : bormi ? 'Parolni almashtirish' : 'Hisob ochish'

  return (
    <details className="rounded-[10px] border border-dashed border-line px-4 py-3">
      <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-ink-2">
        {sarlavha}
        {bormi && <Badge ton="ok">hisobi bor{email ? ` · ${loginNomi(email)}` : ''}</Badge>}
      </summary>

      <form action={hisobOch} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="turi" value={turi} />
        <input type="hidden" name="nishon" value={nishon} />

        {otaOna && (
          <Maydon nom="Ota-ona ismi">
            <input name="ism" type="text" required minLength={3} placeholder="masalan: Dilnoza Karimova" className={kirishKlass} />
          </Maydon>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1.2fr_auto] sm:items-end">

        <Maydon nom="Login" izoh="Oddiy so‘z yetadi. O‘quvchi keyin Profil bo‘limida o‘zi almashtiradi.">
          <input
            name="email"
            type="text"
            required
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={email ? loginNomi(email) : taklif}
            placeholder="aziza"
            className={kirishKlass}
          />
        </Maydon>

        <Maydon nom="Parol" izoh="Nusxalab oling — keyin ko‘rinmaydi">
          <input name="parol" required minLength={8} defaultValue={tavsiyaParol()} className={kirishKlass} />
        </Maydon>

          <Yuborish tur={bormi ? 'ikkilamchi' : 'asosiy'}>
            {bormi ? 'Parolni saqlash' : otaOna ? 'Ochish' : 'Hisob ochish'}
          </Yuborish>
        </div>
      </form>

      <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
        {otaOna
          ? `Ota-ona shu login va parol bilan kiradi va faqat ${ism} ning ma’lumotini (guruh, davomat, qarz, to‘lov) ko‘radi — o‘zgartira olmaydi.`
          : `${ism} shu login va parol bilan kiradi va faqat ${turi === 'oquvchi' ? 'o‘z sahifasini' : 'o‘z guruhlari va davomatini'} ko‘radi.`}
      </p>
    </details>
  )
}
