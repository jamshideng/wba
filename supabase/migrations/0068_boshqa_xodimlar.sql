-- ============================================================
--  0068 — BOSHQA XODIMLAR (Jamshid, 13.10)
--
--  "Xodimlar" bo'limi uch qismdan: Administratorlar (tizimga kiradigan
--  xodimlar, /crm/xodimlar), Ustozlar va Boshqa xodimlar — farrosh,
--  qorovul, oshpaz va h.k. Ular tizimga KIRMAYDI: login yo'q, faqat
--  ro'yxat (ism, lavozim, telefon, oylik).
--
--  Huquq: faqat admin/direktor. O'chirilmaydi — "ketgan" qilinadi.
-- ============================================================

create table if not exists boshqa_xodimlar (
  id            bigint generated always as identity primary key,
  ism           text not null check (length(trim(ism)) > 0),
  lavozim       text not null check (length(trim(lavozim)) > 0),
  telefon       text,
  oylik         numeric(14, 0) check (oylik is null or oylik >= 0),
  ishga_kirgan  date,
  holat         text not null default 'faol' check (holat in ('faol', 'ketgan')),
  izoh          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table boshqa_xodimlar is
  'Tizimga kirmaydigan xodimlar (farrosh, qorovul …). Oylik — so''m, null = belgilanmagan. O''chirilmaydi — holat = ketgan.';

alter table boshqa_xodimlar enable row level security;
alter table boshqa_xodimlar force row level security;

drop policy if exists boshqa_xodimlar_admin on boshqa_xodimlar;
create policy boshqa_xodimlar_admin on boshqa_xodimlar for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

grant select, insert, update on boshqa_xodimlar to authenticated;
grant all on boshqa_xodimlar to service_role;

drop trigger if exists boshqa_xodimlar_audit on boshqa_xodimlar;
create trigger boshqa_xodimlar_audit after insert or update or delete on boshqa_xodimlar
  for each row execute function audit_trigger();
