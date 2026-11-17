-- ============================================================
-- 0133 — Tadbirga ro'yxat (Jamshid, 17.11.2026)
--   Guruhdagi e'lon ostidagi "Kela olaman" tugmasi botni ochadi
--   (t.me/<bot>?start=tadbir_<kod>). Bot shaxsiy chatda ism-familiya,
--   yosh va mehmon sonini so'raydi. Ro'yxatni faqat rahbariyat ko'radi:
--   yozish — faqat webhook (service_role), o'qish — faqat admin.
-- ============================================================

create table if not exists tadbir_royxat (
  id          bigint generated always as identity primary key,
  tadbir      text not null,
  tg_id       bigint not null,
  tg_ism      text,
  tg_username text,
  ism         text,
  yosh        int check (yosh between 3 and 99),
  mehmon      int not null default 0 check (mehmon between 0 and 10),
  holat       text not null default 'ism' check (holat in ('ism', 'yosh', 'mehmon', 'tayyor')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tadbir, tg_id)
);

alter table tadbir_royxat enable row level security;
alter table tadbir_royxat force row level security;
grant all on tadbir_royxat to service_role;
grant select on tadbir_royxat to authenticated;

create policy tadbir_royxat_oqish on tadbir_royxat for select to authenticated
  using (app_is_admin());
