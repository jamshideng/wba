import { randomBytes } from 'node:crypto'
import { Maydon, kirishKlass } from '@/components/forma'

/** Tayyor tavsiya parol bilan maydon (hisob.tsx dagi usul) — admin nusxalab beradi */
export function ParolMaydon({ nom = 'Parol' }: { nom?: string }) {
  return (
    <Maydon nom={nom} izoh="Nusxalab oling — keyin ko‘rinmaydi">
      <input name="parol" required minLength={8} defaultValue={randomBytes(6).toString('base64url')} autoComplete="off" className={kirishKlass} />
    </Maydon>
  )
}
