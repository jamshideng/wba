-- ============================================================
-- 0112 — maosh to'lovlari (Jamshid, 01.11)
--
-- Hisob va pul ajratiladi:
--   tasdiq  — oy hisobini qulflaydi, xarajat yozmaydi (ikki marta sanalardi);
--   to'lov  — kim, qaysi oy uchun, avans yoki maosh. Xarajatga pul berilgan
--             sana bilan tushadi, "qaysi oy uchun" alohida turadi.
-- Holat: hisoblandi − berildi = qoldi; 0 yoki kam bo'lsa — olindi.
-- Ustoz maoshi tasdiqdan keyin beriladi (avans istalgan payt). Admin va fix
-- oylik oladigan xodimlarda kutish yo'q.
-- ============================================================

create table if not exists maosh_tolovlar (
  id              bigint generated always as identity primary key,
  davr            text not null check (davr ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  turi            text not null check (turi in ('avans', 'maosh')),
  teacher_id      text references teachers (id) on delete restrict,
  profile_id      uuid references profiles (id) on delete restrict,
  boshqa_xodim_id bigint references boshqa_xodimlar (id) on delete restrict,
  summa           numeric(14, 0) not null check (summa > 0),
  sana            date not null,
  izoh            text,
  xarajat_id      bigint not null unique references xarajatlar (id) on delete restrict,
  kiritgan        uuid references profiles (id) default auth.uid(),
  bekor           boolean not null default false,
  created_at      timestamptz not null default now(),
  check (num_nonnulls(teacher_id, profile_id, boshqa_xodim_id) = 1)
);
create index if not exists maosh_tolovlar_davr on maosh_tolovlar (davr) where not bekor;

alter table maosh_tolovlar enable row level security;
alter table maosh_tolovlar force row level security;

drop policy if exists maosh_tolovlar_oqish on maosh_tolovlar;
create policy maosh_tolovlar_oqish on maosh_tolovlar for select to authenticated
  using (
    app_is_manager()
    or (teacher_id is not null and (app_is_admin() or teacher_id = app_teacher_id()))
    or profile_id = auth.uid()
  );
revoke all on maosh_tolovlar from public, anon;
grant select on maosh_tolovlar to authenticated;

drop trigger if exists maosh_tolovlar_audit on maosh_tolovlar;
create trigger maosh_tolovlar_audit after insert or update or delete on maosh_tolovlar
  for each row execute function audit_trigger();

/* Xarajat bekor bo'lsa, to'lov ham bekor: kassa va maosh ajralib qolmasin */
create or replace function xarajat_bekor_tolovga() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.bekor and not old.bekor then
    update maosh_tolovlar set bekor = true where xarajat_id = new.id and not bekor;
  end if;
  return null;
end;
$$;
revoke execute on function xarajat_bekor_tolovga() from public, anon, authenticated;

drop trigger if exists xarajat_bekor_tolovga on xarajatlar;
create trigger xarajat_bekor_tolovga after update of bekor on xarajatlar
  for each row execute function xarajat_bekor_tolovga();

-- ------------------------------------------------------------
-- To'lov kiritish. p_tur: ustoz | xodim | boshqa
-- ------------------------------------------------------------
create or replace function maosh_tolov_qosh(
  p_tur text, p_kim text, p_davr text, p_turi text, p_summa numeric, p_sana date, p_izoh text
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_ism text;
  v_xid bigint;
  v_id  bigint;
  v_izoh text := nullif(btrim(coalesce(p_izoh, '')), '');
begin
  if p_davr !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Oy YYYY-MM ko''rinishida bo''lsin.';
  end if;
  if p_turi not in ('avans', 'maosh') then
    raise exception 'To''lov turini tanlang.';
  end if;
  if coalesce(p_summa, 0) <= 0 then
    raise exception 'Summa noto''g''ri.';
  end if;
  if p_sana is null or p_sana > bugun_toshkent() then
    raise exception 'Berilgan sana bugundan keyin bo''lmaydi.';
  end if;

  if p_tur = 'ustoz' then
    if not app_is_admin() then raise exception 'To''lovni admin, manager yoki direktor kiritadi.'; end if;
    select ism into v_ism from teachers where id = p_kim;
    if p_turi = 'maosh' and not maosh_oy_qulfmi(p_davr) then
      raise exception 'Ustoz maoshi direktor oyni tasdiqlagach beriladi. Hozircha avans kiriting.';
    end if;
  elsif p_tur = 'xodim' then
    if not app_is_manager() then raise exception 'Xodim oyligini manager yoki direktor kiritadi.'; end if;
    select ism into v_ism from profiles where id = p_kim::uuid;
  elsif p_tur = 'boshqa' then
    if not app_is_manager() then raise exception 'Xodim oyligini manager yoki direktor kiritadi.'; end if;
    select ism into v_ism from boshqa_xodimlar where id = p_kim::bigint;
  else
    raise exception 'Noma''lum oluvchi.';
  end if;
  if v_ism is null then
    raise exception 'Oluvchi topilmadi.';
  end if;

  insert into xarajatlar (sana, toifa, summa, izoh)
  values (p_sana, 'maosh', p_summa,
          format('%s · %s · %s%s', case p_turi when 'avans' then 'Avans' else 'Maosh' end, p_davr, v_ism,
                 case when v_izoh is null then '' else ' · ' || v_izoh end))
  returning id into v_xid;

  insert into maosh_tolovlar (davr, turi, teacher_id, profile_id, boshqa_xodim_id, summa, sana, izoh, xarajat_id)
  values (p_davr, p_turi,
          case when p_tur = 'ustoz' then p_kim end,
          case when p_tur = 'xodim' then p_kim::uuid end,
          case when p_tur = 'boshqa' then p_kim::bigint end,
          p_summa, p_sana, v_izoh, v_xid)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function maosh_tolov_qosh(text, text, text, text, numeric, date, text) from public, anon;
grant execute on function maosh_tolov_qosh(text, text, text, text, numeric, date, text) to authenticated;

create or replace function maosh_tolov_bekor(p_id bigint, p_sabab text) returns void
language plpgsql security definer set search_path = public as $$
declare v_t maosh_tolovlar;
begin
  select * into v_t from maosh_tolovlar where id = p_id and not bekor;
  if v_t.id is null then
    raise exception 'To''lov topilmadi yoki allaqachon bekor qilingan.';
  end if;
  if v_t.teacher_id is not null and not app_is_admin() then
    raise exception 'To''lovni admin, manager yoki direktor bekor qiladi.';
  end if;
  if v_t.teacher_id is null and not app_is_manager() then
    raise exception 'Xodim oyligini manager yoki direktor bekor qiladi.';
  end if;
  if coalesce(btrim(p_sabab), '') = '' then
    raise exception 'Bekor qilish sababini yozing.';
  end if;
  update xarajatlar set bekor = true, bekor_sabab = 'Maosh to''lovi bekor: ' || btrim(p_sabab) where id = v_t.xarajat_id;
end;
$$;
revoke execute on function maosh_tolov_bekor(bigint, text) from public, anon;
grant execute on function maosh_tolov_bekor(bigint, text) to authenticated;

-- ------------------------------------------------------------
-- Oy holati: hisoblandi, avans, maosh, qoldi
-- ------------------------------------------------------------
create or replace function maosh_tolov_holati(p_davr text)
returns table (tur text, kim text, ism text, lavozim text, hisob numeric, avans numeric, maosh numeric, qoldi numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  v_oxir date;
begin
  if p_davr !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Oy YYYY-MM ko''rinishida bo''lsin.';
  end if;
  v_oxir := (to_date(p_davr || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date;

  if app_is_admin() or app_teacher_id() is not null then
    return query
    select 'ustoz'::text, u.teacher_id, u.ism, 'Ustoz'::text, u.yakuniy, b.a, b.m, u.yakuniy - b.a - b.m
    from ustoz_maosh(p_davr) u
    cross join lateral (
      select coalesce(sum(t.summa) filter (where t.turi = 'avans'), 0) a,
             coalesce(sum(t.summa) filter (where t.turi = 'maosh'), 0) m
      from maosh_tolovlar t where t.davr = p_davr and not t.bekor and t.teacher_id = u.teacher_id
    ) b
    where u.yakuniy <> 0 or b.a + b.m <> 0;
  end if;

  if app_is_manager() then
    return query
    select 'xodim'::text, x.profile_id::text, x.ism, x.rol::text, x.yakuniy, b.a, b.m, x.yakuniy - b.a - b.m
    from xodim_maosh(p_davr) x
    cross join lateral (
      select coalesce(sum(t.summa) filter (where t.turi = 'avans'), 0) a,
             coalesce(sum(t.summa) filter (where t.turi = 'maosh'), 0) m
      from maosh_tolovlar t where t.davr = p_davr and not t.bekor and t.profile_id = x.profile_id
    ) b;

    return query
    select 'boshqa'::text, o.id::text, o.ism, o.lavozim, coalesce(o.oylik, 0), b.a, b.m, coalesce(o.oylik, 0) - b.a - b.m
    from boshqa_xodimlar o
    cross join lateral (
      select coalesce(sum(t.summa) filter (where t.turi = 'avans'), 0) a,
             coalesce(sum(t.summa) filter (where t.turi = 'maosh'), 0) m
      from maosh_tolovlar t where t.davr = p_davr and not t.bekor and t.boshqa_xodim_id = o.id
    ) b
    where (o.holat = 'faol' and (o.ishga_kirgan is null or o.ishga_kirgan <= v_oxir)) or b.a + b.m <> 0;
  end if;
end;
$$;
revoke execute on function maosh_tolov_holati(text) from public, anon;
grant execute on function maosh_tolov_holati(text) to authenticated;

-- ------------------------------------------------------------
-- Tasdiq endi xarajat yozmaydi
-- ------------------------------------------------------------
do $$
declare
  v_def text := pg_get_functiondef('maosh_tasdiqla(text)'::regprocedure);
  v_joy text := 'if v_gross > 0 then';
begin
  if (length(v_def) - length(replace(v_def, v_joy, ''))) / length(v_joy) <> 2 then
    raise exception '0112: maosh_tasdiqla kutilgan ko''rinishda emas';
  end if;
  execute replace(v_def, v_joy, 'if false then  -- 0112: xarajat to''lov bilan yoziladi');
end $$;
