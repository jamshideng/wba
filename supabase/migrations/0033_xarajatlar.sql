-- ============================================================
--  0033 — XARAJATLAR VA OYLIK MOLIYA (LevelUp'dan ko'chirish, 3-bo'lim)
--
--  LevelUp `expenses` (filial xarajatlari) ning WBA'dagi o'rni.
--  Bitta markaz — filial/tashkilot ustunlari kerak emas.
--
--  Qoidalar:
--    • Yozadi — admin va direktor (app_is_admin). Qabulxona ko'radi.
--      Ustoz, o'quvchi, ota-ona — umuman ko'rmaydi.
--    • O'chirilmaydi — to'lovlar kabi "bekor" qilinadi, sababi bilan.
--      Har o'zgarish audit_log ga tushadi.
--    • oylik_moliya(davr) — o'sha oyning tushumi (tasdiqlangan, bekor
--      bo'lmagan to'lovlar, to'lov SANASI bo'yicha — kassa hisobi),
--      xarajati va sof foydasi; toifalar bo'yicha bo'linma bilan.
-- ============================================================

create table if not exists xarajatlar (
  id          bigint generated always as identity primary key,
  sana        date        not null default bugun_toshkent(),
  toifa       text        not null check (toifa in
                ('ijara', 'maosh', 'kommunal', 'reklama', 'jihoz', 'ofis', 'soliq', 'boshqa')),
  summa       numeric(14, 0) not null check (summa > 0),
  izoh        text,
  kiritgan    uuid references profiles(id) default auth.uid(),
  bekor       boolean     not null default false,
  bekor_sabab text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (not bekor or bekor_sabab is not null)
);

create index if not exists xarajatlar_sana on xarajatlar (sana desc) where not bekor;

comment on table xarajatlar is
  'Markaz xarajatlari (ijara, maosh, reklama…). O''chirilmaydi — bekor qilinadi. LevelUp expenses o''rni.';

alter table xarajatlar enable row level security;

drop policy if exists xarajatlar_staff_read on xarajatlar;
create policy xarajatlar_staff_read on xarajatlar for select to authenticated
  using (app_is_staff());

drop policy if exists xarajatlar_admin_insert on xarajatlar;
create policy xarajatlar_admin_insert on xarajatlar for insert to authenticated
  with check (app_is_admin() and not bekor);

-- Faqat bekor qilish (summa/sana/toifa keyin o'zgarmaydi — trigger tekshiradi)
drop policy if exists xarajatlar_admin_update on xarajatlar;
create policy xarajatlar_admin_update on xarajatlar for update to authenticated
  using (app_is_admin()) with check (app_is_admin());

grant select, insert, update on xarajatlar to authenticated;
grant all on xarajatlar to service_role;

create or replace function xarajat_ozgarish_qulf() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.bekor then
    raise exception 'Bekor qilingan xarajat o''zgarmaydi.';
  end if;
  if new.sana is distinct from old.sana or new.toifa is distinct from old.toifa
     or new.summa is distinct from old.summa or new.kiritgan is distinct from old.kiritgan then
    raise exception 'Xarajat o''zgarmaydi — bekor qilib, to''g''risini qayta kiriting.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists xarajatlar_qulf on xarajatlar;
create trigger xarajatlar_qulf before update on xarajatlar
  for each row execute function xarajat_ozgarish_qulf();

drop trigger if exists xarajatlar_audit on xarajatlar;
create trigger xarajatlar_audit after insert or update or delete on xarajatlar
  for each row execute function audit_trigger();

-- ------------------------------------------------------------
-- Oylik moliya: tushum − xarajat
-- ------------------------------------------------------------
create or replace function oylik_moliya(p_davr text)
returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  v_dan   date;
  v_gacha date;
  v_t     numeric;
  v_x     numeric;
begin
  if not app_is_staff() and auth.uid() is not null then
    raise exception 'Moliya faqat xodimlarga ochiq.';
  end if;
  if p_davr !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Oy YYYY-MM ko''rinishida bo''lsin.';
  end if;
  v_dan   := (p_davr || '-01')::date;
  v_gacha := (v_dan + interval '1 month - 1 day')::date;

  select coalesce(sum(summa), 0) into v_t
  from payments where not bekor and tasdiqlangan and sana between v_dan and v_gacha;

  select coalesce(sum(summa), 0) into v_x
  from xarajatlar where not bekor and sana between v_dan and v_gacha;

  return jsonb_build_object(
    'davr', p_davr,
    'tushum', v_t,
    'xarajat', v_x,
    'foyda', v_t - v_x,
    'toifalar', coalesce((
      select jsonb_agg(jsonb_build_object('toifa', toifa, 'summa', s, 'soni', n) order by s desc)
      from (select toifa, sum(summa) s, count(*) n from xarajatlar
            where not bekor and sana between v_dan and v_gacha group by toifa) q
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function oylik_moliya(text) from public, anon;
grant  execute on function oylik_moliya(text) to authenticated, service_role;
