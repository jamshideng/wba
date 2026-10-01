'use client'

import { useState } from 'react'
import { MahsulotRasm } from './bolaklar'

/** Mahsulot rasmlari: katta rasm + pastida kichiklari (bosilsa almashadi) */
export function Galereya({ rasmlar, nom }: { rasmlar: string[]; nom: string }) {
  const [i, setI] = useState(0)
  const joriy = rasmlar[i] ?? rasmlar[0] ?? null

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-[12px] border border-line bg-surface">
        <MahsulotRasm url={joriy} nom={nom} />
      </div>
      {rasmlar.length > 1 && (
        <ul className="grid grid-cols-5 gap-2 sm:grid-cols-6" aria-label="Rasmlar">
          {rasmlar.map((u, j) => (
            <li key={u}>
              <button
                type="button"
                onClick={() => setI(j)}
                aria-label={`${j + 1}-rasm`}
                aria-pressed={i === j}
                className={`block w-full overflow-hidden rounded-[9px] border-2 transition ${
                  i === j ? 'border-brand' : 'border-transparent opacity-80 hover:opacity-100'
                }`}
              >
                <MahsulotRasm url={u} nom="" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
