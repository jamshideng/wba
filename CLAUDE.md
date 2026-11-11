# WBA — sayt va CRM

World Bridge Academy (Toshkent, 2018 yildan) uchun o'quv markazi tizimi.
Bu fayl Claude Code uchun — loyihaning doimiy konteksti.

**Til:** kod, izoh, commit, o'zgaruvchi nomlari — **o'zbekcha**. Jamshid bilan
ham o'zbekcha gaplashiladi. `student_id`, `created_at` kabi baza standartlari
inglizcha qoladi.

---

## Bu papkada IKKI TIZIM bor

### 1. Hozir ISHLAYOTGAN tizim — Apps Script + Telegram bot

`C:\Users\Acer-PC\Desktop\wba_bot\` ildizidagi ~50 ta `.js` fayl.

- Google Apps Script loyihasi, `clasp` bilan deploy qilinadi (`.clasp.json`)
- Telegram bot + Google Sheets, `proksi/worker.js` — Cloudflare Worker
  (Apps Script 302 qaytargani uchun Telegram'ga 200 ni Worker beradi)
- Rollar: **admin**, **direktor** (to'lovni tasdiqlaydi), **ustoz** —
  `Z_Rollar.js` da Telegram ID'lar bo'yicha
- Markaz bugun shu tizimda ishlaydi. **BU KOD BUZILMASIN.**

> Yangi tizim tayyor bo'lgunicha bot ishlab turadi. Apps Script fayllarini
> faqat Jamshid aniq so'raganda o'zgartiriladi. O'qish — bemalol, u yerda
> haqiqiy biznes mantiq yozilgan.

### 2. Qurilayotgan tizim — Next.js + Supabase

`wba-loyiha\wba\` — asosiy ish shu yerda.

- Next.js 15 (App Router) · TypeScript · Tailwind 4
- Supabase: Postgres + Auth + RLS
- `wba.uz` — ommaviy sayt · `app.wba.uz` → `/crm/*` (next.config.ts rewrite)

---

## Sheets — HAQIQIY tuzilma

Manba: `Students_wba` jadvalini quradigan Apps Script fayllarining o'zi.
**`_tahlil.txt` ni ishlatmang** — u eski `Payments_of_Students_2026` ni tasvirlaydi
(u yerdagi `Oylik_holat`, `Tekshirish`, `Log` varaqlari bu jadvalda YO'Q, `Kod.js:54`).

| Varaq | Ustunlar | Manba |
|---|---|---|
| `O'quvchilar` | ID · Ism familya · Tug'ilgan sana · Yosh · Ota telefoni · Ona telefoni · Shaxsiy telefon · Guruh · Yo'nalish · O'qituvchi · Dars vaqti · Oylik narx · Qo'shilgan sana · Holat · Izoh · **Tanlov** · Jami to'langan · … · Keyingi oy | `B_Yangi.js:224`, `D_Tolov.js:24` |
| `Guruhlar` | Guruh ID · Guruh nomi · Yo'nalish · O'qituvchi · Boshlanish · Tugash · **Kun** · Dars vaqti · Oylik narx · O'quvchilar · Holat | `R_Guruh.js:121` |
| `Ustozlar` | ID · O'qituvchi · Telefon · Guruhlari · O'quvchilari · Holat · **Telegram ID** (7-ustun) | `B_Yangi.js:193`, `BOT_Baza.js:61` |
| `Qatnashuv` | ID · O'quvchi · Guruh · Boshlandi · Tugadi · 1-chegirma · 1-necha oy · 2-chegirma · 2-necha oy · **Tanlov** · Yo'nalish · O'qituvchi · Dars vaqti · Oylik narx · Oylar · Hisoblangan · … · To'lashi kerak · To'langan · **Qarz** · Keyingi oy · Izoh | `U_Qatnashuv.js:48` |
| `Tolovlar` | ID · Sana · **O'quvchi** · Davr · Summa · Usul · Izoh · O'quvchi ID · Guruh · Yo'nalish · O'qituvchi · Oylik narx · Oy · Kiritilgan · … · **Tasdiq** · **Tasdiqlangan** | `D_Tolov.js:71`, `T_Tasdiq.js:32` |
| `Narxlar` | ID · Guruh · Narx · Qaysi oydan · Izoh · Oy # · Dan # · Gacha # · Holat | `N_Narxlar.js:149` |
| `Probniylar` | ID · F.I.Sh · … · Guruh · Holat · O'tkazilgan | `Y_Probniy.js:80` |
| `Davomat toq` / `Davomat juft` / `Davomat dam olish` | № · Ism · Tel · 15 ta dars kuni · Foiz · Izoh · Kalit | `Q_Jurnal.js:50` |

**Kalitlar.** O'quvchi — `Ism familya (S001)`; qatnashuv va to'lov —
`Ism familya (S001) · Guruh nomi`. Guruh nomi formula:
`Yo'nalish · O'qituvchi · Dars vaqti` (vaqt o'zgarsa nom ham o'zgaradi).

**"Uzun" varaqlar.** Formulalar 300 (Tolovlar 1500) qatorgacha oldindan qo'yilgan,
ya'ni `getLastRow()` aldaydi. Haqiqiy oxir kalit ustuni bo'yicha topiladi
(`BOT_Baza.js:82`). O'quvchi qatori hech qachon `deleteRow` qilinmaydi: ID = `ROW()-1`.

**Moslik:** `Qatnashuv` → `enrollments`, `Tolovlar` → `payments`,
`Guruhlar` → `groups`, `Ustozlar` → `teachers`, `O'quvchilar` → `students`.

**`invoices` mos keladigan varaq yo'q.** Qarz Qatnashuvning o'z qatorida
hisoblanadi: `Narxlar` tarixidagi oylik narx × oylar − ikki bosqichli chegirma
(`U_Qatnashuv.js:69-133`). Chegirmaning "necha oy" katagi bo'sh bo'lsa — muddatsiz.
Ko'chirishda hisob-fakturalar shu qoida bo'yicha qayta hisoblanadi va
Qatnashuvning `To'lashi kerak` / `To'langan` / `Qarz` ustunlari bilan solishtiriladi.

---

## Baza qoidalari — buzilmaydi

1. **`qarz = Σ invoices.summa − Σ payments.summa`.** Narx **guruhga**,
   chegirma **enrollment**'ga yoziladi. O'quvchi qatoriga narx yozilmaydi.
2. **Bitta o'quvchi — bitta `students` yozuvi.** Ikki kursda o'qisa —
   ikkita `enrollments`. Tushum ikki marta sanalmaydi.
3. **To'lov o'chirilmaydi.** `bekor = true` qilinadi. Bazadagi trigger
   `DELETE` ni umuman o'tkazmaydi.
4. **Huquq RLS'da, kodda emas.** Sahifada xato bo'lsa ham ustoz boshqa
   guruhni ko'rmaydi. Yangi jadval qo'shsangiz — RLS qoidasini ham yozing.
5. **View'larda `security_invoker = on`** bo'lishi shart, aks holda RLS
   chetlab o'tiladi.
6. **`service_role` kaliti** faqat: saytdagi ariza formasi, cron, ko'chirish
   skripti va **hisob ochish** (`/crm/hisoblar/actions.ts`). Boshqa hech qayerda.

   Hisob ochish — bitta ataylab qilingan istisno: auth foydalanuvchisini
   yaratishni RLS bilan qilib bo'lmaydi. U yerda tartib shunday: avval
   oddiy (RLS) klient bilan `talabRol('admin','direktor')`, keyin
   service_role FAQAT `auth.admin.createUser` uchun, qolgan yozuvlar
   yana oddiy klient bilan, oxirida `audit_log` ga iz. Rol
   `app_metadata` ga yoziladi (0008) — foydalanuvchi o'zi o'zgartira olmaydi.

   Ikkinchi tor istisno — **o'z loginini almashtirish** (`/crm/profil/actions.ts`):
   loginlar haqiqiy pochta emas, Supabase esa email o'zgarishini pochta
   orqali tasdiqlatadi. Tasdiqni joriy parol bilan o'zimiz qilamiz va
   faqat O'Z hisobi (`men.id`) o'zgaradi. Parolni almashtirish esa
   oddiy sessiya bilan (`auth.updateUser`), admin kalitisiz.

   Login — oddiy so'z (`aziza`), tizim `@wba.uz` ni o'zi qo'shadi (`src/lib/login.ts`).

   Uchinchi istisno — **Telegram bot webhook'i** (`src/app/api/telegram/route.ts`, 0021):
   Telegram so'rovida sayt sessiyasi yo'q. Huquq o'sha faylda tekshiriladi: chat
   `telegram_ulanish` da kimga ulangan bo'lsa, so'rov faqat o'sha o'quvchi/ustoz/xodim
   ID'si bilan cheklanadi; tugma ma'lumotiga (callback_data) ishonilmaydi. Ulash
   funksiyalari (`telegram_ula_*`) faqat `service_role` ga ochiq. E'lon yuborish
   (`/crm/xabarlar`) esa admin nomidan, RLS bilan — service_role'siz.

---

## Buyruqlar

```bash
npm run dev          # ishlab chiqish serveri
npm run typecheck    # TypeScript
npm test             # parser testlari
npm run db:test      # sxema + RLS testi (lokal Postgres kerak)
npm run migrate:dry  # Sheets'dan nima ko'chishini ko'rsatadi, yozmaydi
npm run migrate      # bazaga yozadi
```

Har o'zgarishdan keyin **`npm run typecheck`** va tegishli test.
Baza o'zgarsa — **`npm run db:test`**.

---

## Kod uslubi

- Server Component birinchi. `'use client'` faqat haqiqatan interaktiv joyga.
- Ma'lumot olish — server tomonda, `createClient()` orqali (RLS ishlasin).
- Hisob-kitob **bazada** (view yoki funksiya), ilovada emas.
- Komponentlar: `src/components/ui.tsx` dagi `Card`, `Stat`, `Badge`,
  `Button`, `Empty`, `BarRow`. Yangi uslub o'ylab topishdan oldin shularni
  qarang.
- Rang, shrift, oraliq — `src/app/globals.css` dagi tokenlar. Xom hex yozilmaydi.
- Ikonka — `src/components/icons.tsx`. **Emoji ishlatilmaydi.**
- Pul, sana, telefon — `src/lib/format.ts` dagi funksiyalar.
- Hit-target 44px dan kam bo'lmasin.

## Matn uslubi (sayt uchun)

Markazning o'z sotuv skriptidan olingan qoidalar:

- **Faqat rost ma'lumot.** Bilinmagan raqam o'rniga `[ANIQLANMAGAN]`.
- **Narx birinchi gapda aytilmaydi** — avval ehtiyoj, keyin qiymat.
- **"Farzandingiz", "ota-ona" murojaati yo'q** — bolalarning o'zi ham
  qo'ng'iroq qiladi. Umumiy til.

---

## Hal qilinmagan savollar

Bular Jamshiddan javob kutadi. **Taxmin qilib raqam yozilmaydi** — UI
"aniqlanmagan" deb ko'rsatadi.

1. **Ustoz maoshi qanday hisoblanadi?** Sheets'dagi `Ustozlar` varag'ida
   "Maosh turi" va "Qiymati" ustunlari bor — ular to'ldirilganmi, tekshirilsin.
2. **Bir darsda nechta wobl berish mumkin?** Chegara bormi, manfiy ball
   bo'ladimi? (`settings` → `woblr.max_ball_dars` hozircha `null`)
3. **Chegirma miqdorlari:** ikki fanga yozilganda va aka-uka/do'st bilan
   kelganda qancha?

## Davomat tarixi

Sentabrdan beri Sheets'da har bir dars bo'yicha jurnal yuritilyapti
(`Davomat toq` / `Davomat juft` / `Davomat dam olish`, `Q_Jurnal.js`), ya'ni
davomat ko'chirilishi mumkin. Jurnalda uchinchi holat yo'q — katak doim
`true` yoki `false`, shuning uchun `kechikdi` va `sababli` faqat yangi
tizimda paydo bo'ladi.

Undan oldingi (avgust va eskiroq) davomat ko'chirilmaydi: manbada faqat
oylik jamlanma bor.

Kun turi uchta: `Toq kun`, `Juft kun`, `Dam olish` (shanba + yakshanba).
**Shanba ikkala turga ham kiradi** — juft guruh ham, dam olish guruhi ham
o'sha kuni o'qiydi.

## Davomat eslatmasi (0123)

Dars tugagach davomat **to'liq** qilinmagan bo'lsa (har bir faol o'quvchiga
belgi), ustozga eslatma: 1-si tugagach 10 daq, 2-si 60 daq keyin
(`ESLATMA_DAQIQA`, `src/lib/davomat-eslatma.ts`).

- pg_cron `davomat-eslatma` har 5 daqiqa → `POST /api/cron/davomat`,
  `Authorization: Bearer <CRON_SIR>` (kalit Vault'da `cron_sir`); kalitsiz — 401.
  `?sinov=1` — kimga ketishini ko'rsatadi, yubormaydi.
- Nomzodlar bazada (`davomat_eslatma_nomzodlar`): dars kuni (`guruh_dars_kuni`,
  dam kuni chiqariladi), ustoz — `dars_ustozi` (zamena bo'lsa o'rinbosar).
- `davomat_eslatma` — unique(group_id, sana, turi): qator yuborishdan oldin
  band qilinadi, takror ketmaydi. Kanallar: Telegram ("Davomat qilish"
  tugmasi), sayt bildirishnomasi (`manba='davomat'`, `filtr.ustoz`), push.
- Davomat to'lganda attendance trigger eslatma va bildirishnomani yopadi.
- Eslatma vaqti yarim tundan o'tsa yuborilmaydi: ustoz o'tgan kunni kiritmaydi (0085).
- Zamena kuni davomatni faqat o'rinbosar (yoki admin) qiladi; guruh ustozi
  jurnalida o'sha kun "zamena" deb yopiq (`davomat_belgila` ham to'sadi).

---

## Nima qilinmaydi

- Apps Script fayllarini o'z bilganicha o'zgartirish
- `.env.local` ni git'ga qo'shish yoki kalitlarni matnga yozish
- Sheets'ni asosiy baza sifatida ishlatish (u — ko'zgu)
- Taxminiy ma'lumot bilan bo'sh joyni to'ldirish
- Bir necha marta bir xil xatoni takrorlab urinish — to'xtab, Jamshiddan so'rash
