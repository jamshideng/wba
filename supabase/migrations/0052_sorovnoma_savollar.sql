-- ============================================================
--  0052 — So'rovnomada bir nechta savol (Jamshid, 02.10)
--
--  0047 da so'rovnoma = bitta savol (sarlavha) + variantlar. Endi:
--  bildirishnoma (sarlavha — so'rovnoma nomi) → savollar → variantlar.
--  Har savolning o'z "bir nechta tanlasa bo'ladi" belgisi bor.
--  Javob — bitta yuborishda hamma savolga (har savolga kamida bitta).
--
--  Eski so'rovnomalar: bitta savolga aylanadi (savol matni = sarlavha,
--  kop_tanlov — so'rovnomaniki), javoblari joyida qoladi.
-- ============================================================

create table if not exists bildirishnoma_savollar (
  id               bigserial primary key,
  bildirishnoma_id bigint not null references bildirishnomalar (id) on delete cascade,
  matn             text not null check (length(trim(matn)) between 1 and 200),
  kop_tanlov       boolean not null default false,
  tartib           int not null default 0
);
create index if not exists bildirishnoma_savollar_idx on bildirishnoma_savollar (bildirishnoma_id, tartib);

comment on table bildirishnoma_savollar is 'So''rovnoma savollari (0052): bildirishnoma → savollar → variantlar.';

alter table bildirishnoma_variantlar
  add column if not exists savol_id bigint references bildirishnoma_savollar (id) on delete cascade;
create index if not exists bildirishnoma_variantlar_savol_idx on bildirishnoma_variantlar (savol_id, tartib);

-- Eski so'rovnomalar → bitta savol
do $$
declare
  v_b record;
  v_savol bigint;
begin
  for v_b in
    select b.id, b.sarlavha, b.kop_tanlov from bildirishnomalar b
    where exists (select 1 from bildirishnoma_variantlar v where v.bildirishnoma_id = b.id and v.savol_id is null)
  loop
    insert into bildirishnoma_savollar (bildirishnoma_id, matn, kop_tanlov, tartib)
    values (v_b.id, left(v_b.sarlavha, 200), v_b.kop_tanlov, 0)
    returning id into v_savol;
    update bildirishnoma_variantlar set savol_id = v_savol where bildirishnoma_id = v_b.id and savol_id is null;
  end loop;
end $$;

alter table bildirishnoma_variantlar alter column savol_id set not null;

-- Variant o'z savolining so'rovnomasiga tegishli bo'lsin
create or replace function bildirishnoma_variant_mos() returns trigger
language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from bildirishnoma_savollar s where s.id = new.savol_id and s.bildirishnoma_id = new.bildirishnoma_id) then
    raise exception 'Variant boshqa so''rovnoma savoliga bog''langan.';
  end if;
  return new;
end;
$$;
drop trigger if exists bildirishnoma_variant_mos on bildirishnoma_variantlar;
create trigger bildirishnoma_variant_mos before insert or update on bildirishnoma_variantlar
  for each row execute function bildirishnoma_variant_mos();

-- RLS — variantlar bilan bir xil
alter table bildirishnoma_savollar enable row level security;
alter table bildirishnoma_savollar force row level security;
grant usage, select on sequence bildirishnoma_savollar_id_seq to authenticated;

drop policy if exists bildirishnoma_savollar_oqish on bildirishnoma_savollar;
create policy bildirishnoma_savollar_oqish on bildirishnoma_savollar for select to authenticated
  using (exists (select 1 from bildirishnomalar b where b.id = bildirishnoma_id));
drop policy if exists bildirishnoma_savollar_admin on bildirishnoma_savollar;
create policy bildirishnoma_savollar_admin on bildirishnoma_savollar for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

-- ------------------------------------------------------------
-- Javob: har savolga kamida bitta; "bitta tanlov" savolida — faqat bitta
-- ------------------------------------------------------------
create or replace function sorovnomaga_javob(p_id bigint, p_variantlar bigint[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_b bildirishnomalar;
  v_tanlov bigint[] := array(select distinct x from unnest(coalesce(p_variantlar, '{}')) x);
begin
  if auth.uid() is null then raise exception 'Kirish kerak.'; end if;
  select * into v_b from bildirishnomalar where id = p_id;
  if v_b.id is null or v_b.turi <> 'sorovnoma' then raise exception 'So''rovnoma topilmadi.'; end if;
  if v_b.holat <> 'faol' or v_b.boshlanish > now() or (v_b.tugash is not null and v_b.tugash <= now()) then
    raise exception 'So''rovnoma yopilgan.';
  end if;
  if not bildirishnoma_menga(v_b.kimga, v_b.filtr) then raise exception 'Bu so''rovnoma siz uchun emas.'; end if;
  if cardinality(v_tanlov) = 0 then raise exception 'Variantni tanlang.'; end if;
  if exists (select 1 from unnest(v_tanlov) v
             where not exists (select 1 from bildirishnoma_variantlar x where x.id = v and x.bildirishnoma_id = p_id)) then
    raise exception 'Variant noto''g''ri.';
  end if;
  if exists (
    select 1 from bildirishnoma_savollar s
    where s.bildirishnoma_id = p_id
      and not exists (select 1 from bildirishnoma_variantlar x where x.savol_id = s.id and x.id = any (v_tanlov))
  ) then
    raise exception 'Hamma savolga javob bering.';
  end if;
  if exists (
    select 1 from bildirishnoma_savollar s
    where s.bildirishnoma_id = p_id and not s.kop_tanlov
      and (select count(*) from bildirishnoma_variantlar x where x.savol_id = s.id and x.id = any (v_tanlov)) > 1
  ) then
    raise exception 'Bitta tanlovli savolga faqat bitta javob beriladi.';
  end if;

  delete from bildirishnoma_javoblar where bildirishnoma_id = p_id and profile_id = auth.uid();
  insert into bildirishnoma_javoblar (bildirishnoma_id, variant_id, profile_id)
  select p_id, v, auth.uid() from unnest(v_tanlov) v;

  insert into bildirishnoma_holat (bildirishnoma_id, profile_id, yopildi_at)
  values (p_id, auth.uid(), now())
  on conflict (bildirishnoma_id, profile_id) do update set yopildi_at = coalesce(bildirishnoma_holat.yopildi_at, now());
end;
$$;

-- Natija — savol bo'yicha (qaytariladigan ustunlar o'zgardi → qayta yaratiladi)
drop function if exists sorovnoma_natija(bigint);
create function sorovnoma_natija(p_id bigint)
returns table (savol_id bigint, savol_matn text, variant_id bigint, matn text, ovoz bigint, jami bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (app_is_staff() or exists (
      select 1 from bildirishnomalar b
      where b.id = p_id and b.natija_ochiq
        and exists (select 1 from bildirishnoma_javoblar j where j.bildirishnoma_id = p_id and j.profile_id = auth.uid()))) then
    raise exception 'Natija ko''rsatilmaydi.';
  end if;
  return query
    select s.id, s.matn, v.id, v.matn,
           (select count(*) from bildirishnoma_javoblar j where j.variant_id = v.id),
           (select count(distinct j.profile_id) from bildirishnoma_javoblar j where j.bildirishnoma_id = p_id)
    from bildirishnoma_variantlar v
    join bildirishnoma_savollar s on s.id = v.savol_id
    where v.bildirishnoma_id = p_id
    order by s.tartib, s.id, v.tartib, v.id;
end;
$$;
revoke execute on function sorovnoma_natija(bigint) from public, anon;
grant execute on function sorovnoma_natija(bigint) to authenticated;

-- Menga tegishlilar — savollar bilan
create or replace function mening_bildirishnomalarim()
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.muhim desc, x.created_at desc), '[]'::jsonb)
  from (
    select b.id, b.turi, b.sarlavha, b.matn, b.havola, b.havola_matn, b.muhim,
           b.kop_tanlov, b.natija_ochiq, b.created_at,
           h.korildi_at is not null as korilgan,
           h.yopildi_at is not null as yopilgan,
           exists (select 1 from bildirishnoma_javoblar j where j.bildirishnoma_id = b.id and j.profile_id = auth.uid()) as javob_berdim,
           coalesce((select jsonb_agg(jsonb_build_object(
                       'id', s.id, 'matn', s.matn, 'kop_tanlov', s.kop_tanlov,
                       'variantlar', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'matn', v.matn) order by v.tartib, v.id)
                                               from bildirishnoma_variantlar v where v.savol_id = s.id), '[]'::jsonb))
                     order by s.tartib, s.id)
                     from bildirishnoma_savollar s where s.bildirishnoma_id = b.id), '[]'::jsonb) as savollar
    from bildirishnomalar b
    left join bildirishnoma_holat h on h.bildirishnoma_id = b.id and h.profile_id = auth.uid()
    where auth.uid() is not null
      and b.holat = 'faol' and b.boshlanish <= now() and (b.tugash is null or b.tugash > now())
      and bildirishnoma_menga(b.kimga, b.filtr)
    order by b.created_at desc
    limit 30
  ) x
$$;
