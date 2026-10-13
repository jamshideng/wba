---
name: wba-ishga
description: WBA saytini (Next.js + lokal Supabase) ishga tushirish, to'xtatish va "sayt ochilmayapti / kirish ishlamayapti" holatini tuzatish. Foydalanuvchi saytni ko'rmoqchi bo'lsa, "ishlamayapti" desa, yoki brauzerda tekshirish kerak bo'lsa — shu skill.
---

# WBA ni ishga tushirish

Bitta buyruq — hamma qadam ichida:

```bash
npm run ishga            # Docker → Supabase → 3000-port → kerak bo'lsa build → server
npm run ishga -- -Qurish # kod o'zgarmagan bo'lsa ham qayta yig'ish
npm run toxta            # serverni to'xtatish
npm run toxta -- -Baza   # + Supabase (xotira bo'shaydi, ma'lumot qoladi)
```

Server alohida minimallashtirilgan oynada ishlaydi — Claude Code o'z fon
jarayonlarini tozalasa ham o'lmaydi. `npm run ishga` o'zi qaytadi; fon
rejimida yurgizish SHART EMAS.

## Tuzoqlar (hammasi haqiqatda bo'lgan)

| Belgi | Sabab | Qaror |
|---|---|---|
| Sayt ochiladi, kirish "Login yoki parol noto'g'ri", server jurnalida `fetch failed` | Docker Desktop to'xtagan (uxlash/xotira) → Supabase yo'q | `npm run ishga` (o'zi ko'taradi) |
| `/kirish` 404 yoki server boshqa portga (3001, 3002) o'tib ketgan | 3000 ni kechagi qotgan `node` ushlab turibdi | `npm run ishga` (portni tozalaydi) |
| Fon jarayoni "system is running low on memory" bilan o'ldirildi | `next dev` 1 GB+ oladi, kompyuterda 1–4 GB bo'sh | `next dev` ishlatmang — `npm run ishga` (`next start`) |
| `tsc` yoki `next build` "heap out of memory" | xotira kam | `NODE_OPTIONS=--max-old-space-size=3072` |
| Supabase `ports are not available …` | Windows port oralig'ini zaxiralagan (54268–54767, 13.10 dan 58137–58336 ham) | portlar 563xx. Yana band bo'lsa: `netsh int ipv4 show excludedportrange protocol=tcp` → bo'sh oraliq → config.toml, .env.local, next.config.ts, scripts/ishga-tushir.ps1 da almashtirish |
| Background TaskStop dan keyin port hali band | Windows'da `npx` o'lsa ham `node` bolasi qoladi | `npm run toxta` |

## Tekshirish

- Kirish: `jamshid@wba.uz` (admin), `farrux@wba.uz` (direktor) — parollar foydalanuvchida.
- Login oddiy so'z bo'lishi mumkin: `aziza` → `aziza@wba.uz`.
- `loading.tsx` bor sahifalarda redirect oqim ichida keladi — `fetch()` bilan
  "ochiq" ko'rinadi. Huquqni BRAUZERDA (navigate) tekshiring.
- Studio (bazani ko'rish): http://127.0.0.1:56323
