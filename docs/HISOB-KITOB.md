# WBA — hisob-kitob qoidalari (sayt uchun spetsifikatsiya)

> Holat: **2026-09-24**. Manba — jonli `Students_wba` Google Sheets va uning Apps Script kodi
> (`Desktop\wba_bot\*.js`). 24.09 holatiga kundalik ish (to'lov, probniy, davomat) **Sheets'da**
> yuritilmoqda; saytdagi baza 19.09 da to'xtab qolgan. Sayt qayta asosiy tizimga aylanganda
> quyidagi qoidalarning **hammasi** saytda ham bir xil ishlashi kerak — aks holda qarz raqamlari
> Sheets'dagidan farq qiladi.

Har bo'lim oxirida **→ Sayt** belgisi bilan saytda nima qilish kerakligi yozilgan.

---

## 1. Asosiy tushunchalar

| Tushuncha | Sheets'da | Ma'nosi |
|---|---|---|
| O'quvchi | `O'quvchilar`, ID `S001` | Bitta odam. Pul unga emas, **qatnashuviga** yoziladi. |
| Qatnashuv | `Qatnashuv`, ID `Q001` | O'quvchi × guruh. Ikki guruhda o'qisa — **ikki qator**, ikki alohida hisob. |
| Qatnashuv kaliti | `Ism (S001) · Guruh nomi` | To'lov, tuzatish shu kalit bilan bog'lanadi. |
| Davr | `2026-09` (matn) | Oy. Hamma joyda **matn** — Sheets uni sanaga aylantirmasin. |
| Oy raqami | `yil*12 + oy` | Oylarni solishtirish uchun butun son (2026-09 → 24321). |

Guruh nomi `Yo'nalish · O'qituvchi · Dars vaqti` formulasidan yasaladi. Nom o'zgarsa kalitlar
kaskad bilan yangilanadi (`_tolovKaskad`, `_probKaskad`, `_tuzKaskad`). 14.09 da shu kaskad
bo'lmagani uchun 10 ta to'lov (5 750 000) qatnashuvdan uzilib, qarz shishib ketgan edi.

**→ Sayt:** kalit matn emas, `enrollment_id` (uuid). Nom o'zgarishi muammo emas — lekin
Sheets'dan ko'chirishda kalitni `Ism (S###) · Guruh` bo'yicha moslash kerak.

---

## 2. Oylik hisob: "Hisoblangan"

```
Oylar       = DATEDIF(boshlandi, bugun yoki tugadi, "M") + 1
Hisoblangan = Σ (har oyning O'SHA OYDAGI narxi)   — boshlangan oydan boshlab "Oylar" ta oy
```

- **Oylar kelgan KUNDAN sanaladi**, kalendar oyidan emas. 20.09 da kelgan bola: 20.09–19.10 — 1 oy,
  20.10 dan — 2 oy. Boshlangan oyning o'zi darhol to'liq 1 oy.
- **Narx tarixi** (`Narxlar` varag'i, `N_Narxlar.js`): guruh narxi ko'tarilsa o'tgan oylar
  o'zgarmaydi. Har qator "shu narx shu oydan boshlab". Eng birinchi qator orqaga cheksiz amal
  qiladi. Guruhning bitta ham qatori bo'lmasa — guruhning joriy narxi × oylar.
- Hozir hamma guruhda narx **650 000**; farqlar chegirma bilan hal qilinadi (narxni guruhda
  o'zgartirish o'tgan oylarni buzardi).

> ⚠️ **Ochiq qaror (TASKS J10):** "Oylar" kelgan kundan (DATEDIF), lekin narx, chegirma va
> tuzatish **kalendar oyi** bo'yicha tanlanadi (boshlangan oy = 1-oy). Saytdagi
> `create_monthly_invoices` esa sof kalendar oyi bilan ishlaydi (har oyning 1-sanasida
> hisob-faktura). Oy o'rtasida kelgan bolada ikki tizim bir necha kun farq qiladi. Qaysi qoida
> to'g'ri ekanini Jamshid hal qilishi kerak.

**→ Sayt:** har `invoices` qatori o'z oyining narxini saqlaydi (`summa + chegirma`) — bu narx
tarixining o'rnini bosadi. To'g'ri. Qolgani — yuqoridagi ochiq qaror.

---

## 3. Chegirma — 2 bosqich

Qatnashuv qatorida 4 katak: `1-chegirma`, `1-necha oy`, `2-chegirma`, `2-necha oy`.

```
oy = davr qatnashuvning nechanchi oyi (boshlangan kalendar oyi = 1)

1-bosqich:  1 .. d1                  → 1-chegirma
2-bosqich:  d1+1 .. d1+d2            → 2-chegirma
"necha oy" bo'sh = shu bosqich cheksiz (doimiy)
1-bosqich doimiy bo'lsa 2-bosqichga navbat kelmaydi.
```

Hisob **oy raqami** bilan, sana bilan emas — yillar o'tsa ham o'tgan oylar o'zgarmaydi.

Direktor qoidasi (14.09): 600 000 to'lagan → 50 000 doimiy; 450 000 → 200 000 × 1 oy;
400 000 → 250 000 × 1 oy; 4 oyga oldindan to'lagan → 200 000 × 4.

Chegirma istalgan vaqtda tahrirlansa, **o'tgan oylar ham qayta hisoblanadi** (Sheets formulasi
har safar boshidan hisoblaydi).

**→ Sayt:** bor (0006, 0014 `chegirma_ozgartir` — qayta hisoblaydi).

---

## 4. Tuzatishlar — oyma-oy qo'lda ayirish (YANGI, 24.09)

**Muammo:** bola bir necha dars kelmasa (kasallik va h.k.) markaz **o'sha oy uchun** pulni
kamaytiradi. Hamma o'quvchi har oy bir xil to'lamaydi. 2 bosqichli chegirma buni qamramaydi —
u har oy bir xil. Natijada kelishilgan summani to'lagan bola qarzdor bo'lib ko'rinardi.

**Qaror (Jamshid):** admin **o'zi**, **aniq summa** bilan kiritadi. Davomatdan avtomatik
hisoblanmaydi (sababsiz qoldirgan bola chegirma olmasin).

`Tuzatishlar` varag'i (`Y_Tuzatish.js`):

| Ustun | Kim | Izoh |
|---|---|---|
| O'quvchi · guruh | admin | qatnashuv kaliti, ro'yxatdan |
| Oy | admin | `2026-09`; bo'sh → joriy oy |
| Summa (−) | admin | ayiriladigan summa, > 0 |
| Sabab | admin | "kasal, 3 dars" |
| Sana, Kiritilgan, O'qituvchi, Oy raqami | avto | Kiritilgan o'zgarmaydi (iz) |

Bir oyda bir necha marta — alohida qatorlar. Summa keyin o'zgartirilsa eski qiymat izohda qoladi.

**Qayerga ta'sir qiladi:**

```
Tuzatish (Qatnashuv AB) = Σ summa, faqat HISOBLANGAN oylar uchun:
                          oy raqami ≤ boshlangan oy + Oylar − 1
To'lashi kerak          = Hisoblangan − Chegirma jami − Tuzatish
Keyingi oy              = narx − o'sha oy chegirmasi − o'sha oy tuzatishi
Tolovlar "Davr to'lovi" = muhrlangan narx − davr chegirmasi − davr tuzatishi
```

Kelajak oyga yozilgan tuzatish qarzni **oldindan** kamaytirmaydi — o'sha oy hisoblanganda
ayiriladi. Panelda: "Tuzatish (jami)", "Tuzatish (joriy oy)", oylik jadvalda "Tuzatish (−)" ustuni.

**→ Sayt: YO'Q — qo'shish kerak.** Taklif:

```sql
create table invoice_adjustments (
  id            bigserial primary key,
  enrollment_id uuid not null references enrollments (id) on delete cascade,
  davr          text not null check (davr ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  summa         numeric(12,2) not null check (summa > 0),
  sabab         text not null,
  kiritdi       uuid references profiles (id),
  bekor         boolean not null default false,   -- o'chirilmaydi, to'lovdagidek
  created_at    timestamptz not null default now()
);
```

`invoices` summasi: `greatest(narx − chegirma − Σ tuzatish(davr), 0)`. Tuzatish qo'shilsa/
bekor qilinsa o'sha davrning hisob-fakturasi qayta hisoblanadi (0014 dagi chegirma kabi).
Huquq: faqat admin/direktor; audit_log'ga tushsin.

---

## 5. To'lovlar

Admin kiritadi: **qatnashuv kaliti, summa, usul** (Naqd / Karta / Click / Payme), izoh.
Avtomatik: sana, davr (joriy oy), kiritilgan vaqt, guruh, o'qituvchi.

- **Oylik narx muhrlanadi** — o'quvchi tanlangan daqiqadagi narx qiymat bo'lib yoziladi,
  formula emas. Aks holda narx ko'tarilgan kuni eski to'lovlar ham qayta hisoblanardi.
- **Bo'lib to'lash** — har to'lov alohida qator. Tartib qator o'rni bo'yicha emas, **Kiritilgan
  vaqti** bo'yicha (filtr bilan saralansa ham buzilmaydi):
  - `Marta` — shu davrdagi nechanchi to'lov
  - `Shu davr jami` — shu to'lov bilan birga yig'indi
  - `Davr to'lovi` — shu oyda to'lanishi kerak (§4 formulasi)
  - `Qoldiq` = Davr to'lovi − Shu davr jami → `Holat`: Qisman / To'liq / Ortiqcha
- Summasi yozilgan to'lovni **o'zgartirish noto'g'ri** — qo'shimcha to'lov yangi qator.
  O'zgartirilsa eski qiymat izohda qoladi.
- **Tasdiq** — faqat direktor (galochka + vaqt). Panelda tasdiqlanmagan soni va summasi.
- Summasi bo'sh qator to'lov emas, hech qayerda sanalmaydi.

```
To'langan (Qatnashuv) = Σ to'lovlar shu kalit bo'yicha
Qarz                  = To'lashi kerak − To'langan
O'quvchi qarzi        = Σ uning barcha qatnashuvlari
```

**→ Sayt:** `payments` bor, o'chirilmaydi (`bekor`), tasdiq bor. Tekshirish kerak: "Davr to'lovi /
Qoldiq / Holat" mantiqi saytda ham tuzatishni hisobga olsin.

---

## 6. Keyingi oy

"Kelasi oy qancha to'laydi?" — admin darrov javob bera olsin:
`keyingi oy narxi (narx tarixidan) − o'sha oy bosqich chegirmasi − o'sha oyga yozilgan tuzatish`,
0 dan kam emas. Chiqib ketgan (Tugadi to'ldirilgan) qatnashuvda bo'sh.

---

## 7. Probniy → doimiy (24.09 da o'zgardi)

1. Bola `Probniylar`ga yoziladi (ism, telefonlar, guruh). Holat = Probniy.
2. **Davomat jurnalida darhol ko'rinadi**: guruh blokida `Ism · probniy`, kalit `Ism (P002)`,
   Qo'shilgan **kun boshidan** ochiq. Ustoz/admin probniy kunlarini belgilaydi.
3. Bola **to'lov qilgach** admin Holat = **Doimiy** qiladi (bir hafta keyin bo'lishi mumkin):
   - `O'quvchilar`ga tushadi, `Qatnashuv`ga qator ochiladi.
   - **Qatnashuv.Boshlandi = doimiy qilingan kun → pul SHU kundan hisoblanadi.**
   - Davomatda qator **probniy kunidan uzluksiz**, probniy belgilari o'quvchi qatoriga ko'chadi.
4. Kelmadi / Rad etdi — jurnalda ko'rinmaydi; pul hisoblanmaydi.

Ya'ni: **davomat — probniy kunidan, pul — to'lov (doimiy) kunidan.** Ikkisi ataylab ajratilgan.

**→ Sayt:** LevelUp'da `/api/trials` va "Probniy darslar" UI bor, lekin `trial_lessons` uchun
migratsiya yo'q; Next saytida probniy→doimiy oqimi bor, probniyni davomatda ko'rsatish yo'q.
Kerak: probniy o'quvchi davomatda (hisobsiz), doimiyga o'tganda davomat tarixi saqlanadi,
`enrollments.boshlandi` = o'tkazilgan kun.

---

## 8. Davomat va pul

- Davomat **pulga avtomatik ta'sir qilmaydi.** Kelmagan dars uchun ayirish — faqat §4 orqali.
- "Dars o'tkazilmadi" — hamma KELDI qilinadi, sabab izohga yoziladi; foizga kirmaydi (Q4).
- Ustoz faqat o'sha kunni belgilaydi, o'tgan kunni faqat admin tuzatadi (Q5).
- Kun turlari: toq (Du/Ch/Ju), juft (Se/Pa/Sha), dam olish (Sha/Ya). Shanba ikki turga kiradi.

---

## 9. Boshqaruv paneli — ko'rsatkichlar

| Ko'rsatkich | Hisob |
|---|---|
| Jami tushum | Σ barcha to'lovlar |
| Joriy oy tushumi | Σ to'lovlar, davr = joriy oy |
| Jami qarz | Σ o'quvchi qarzi, faqat > 0 |
| Qarzdorlar | qarzi > 0 o'quvchilar soni |
| Berilgan chegirma | Σ Qatnashuv "Chegirma jami" |
| Tuzatish (jami / joriy oy) | §4 |
| Tasdiqlanmagan to'lov / summa | direktor tasdiqlamagan |
| Oylik tushum (12 oy) | davr bo'yicha tushum, to'lovlar soni, tuzatish |
| O'qituvchi / yo'nalish kesimi | tushum va qarz |

24.09 holati: 79 faol o'quvchi, 23 guruh, jami tushum 25 500 000, jami qarz 28 330 000,
berilgan chegirma 3 150 000, tuzatish 0.

---

## 10. Saytga ko'chirishda tekshiruv ro'yxati

- [ ] Oy sanash qoidasi hal qilingan (§2 ochiq qaror) va ikki tizimda bir xil
- [ ] Narx tarixi: har hisob-faktura o'z oyining narxini saqlaydi
- [ ] 2 bosqichli chegirma, tahrirda o'tgan oylar qayta hisoblanadi
- [ ] **Tuzatishlar jadvali** (§4) — hisob-fakturaga, keyingi oyga, panelga ulangan
- [ ] To'lov: o'chirilmaydi, narx muhrlanadi, bo'lib to'lash holati (Qisman/To'liq/Ortiqcha)
- [ ] Direktor tasdig'i
- [ ] Probniy davomatda ko'rinadi, pul doimiy kundan (§7)
- [ ] Ko'chirishdan keyin **har qatnashuv bo'yicha** Sheets `To'lashi kerak / To'langan / Qarz`
      bilan solishtirish (`npm run migrate:dry` shunday qiladi — tuzatishni ham qo'shish kerak)
- [ ] Panel raqamlari Sheets paneli bilan bir xil

## Kod manbalari (Apps Script, `Desktop\wba_bot`)

| Fayl | Nima |
|---|---|
| `U_Qatnashuv.js` | Qatnashuv ustunlari va formulalari (`_qatnRoyxat`) |
| `H_Himoya.js` | Barcha avtomatik formulalarning yagona manbai, `_chegOyBoyicha`, To'lovlar |
| `N_Narxlar.js` | Narx tarixi (`_narxJamiUmumiy`, `_narxOyda`) |
| `Y_Tuzatish.js` | Tuzatishlar varag'i, `TUZATISH()`, `SINOV_TUZATISH()` |
| `D_Tolov.js` | To'lovlar varag'i, narx muhrlash, kaskadlar |
| `Y_Probniy.js` | Probniy → doimiy, `_probJurnal` (davomatda probniy) |
| `K_Panel.js` | Boshqaruv paneli |
