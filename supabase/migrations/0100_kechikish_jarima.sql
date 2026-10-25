-- ============================================================
--  0100 — Ustoz kechikishi uchun AVTOMATIK jarima (Jamshid, 25.10)
-- ============================================================
--  Ustoz davomatida (ustoz_kechikish, 0060) har kechikish daqiqasi uchun
--  maoshdan jarima: daqiqa × settings 'maosh.kechikish_jarima' (5 000 so'm).
--    · kechikish yozilsa — maosh_harakatlar ga 'jarima' (kechikish_id bilan);
--    · daqiqa / sana / ustoz o'zgarsa — eski jarima bekor, yangisi yoziladi;
--    · kechikish o'chirilsa (bekor) — jarima ham bekor qilinadi.
--  Tasdiqlangan oy o'zgarmaydi (maosh_harakat_qulf — 0075).
--  Hozirgi tasdiqlanmagan oylardagi kechikishlarga ham jarima yoziladi.
-- ============================================================

insert into settings (kalit, qiymat, tavsif)
values ('maosh.kechikish_jarima', '5000'::jsonb,
        'Ustoz kechikishi: bir daqiqa uchun jarima (so''m). Ustoz davomatidagi har kechikishga avtomatik yoziladi.')
on conflict (kalit) do nothing;

alter table maosh_harakatlar add column if not exists kechikish_id uuid;
create unique index if not exists maosh_harakatlar_kechikish_uq
  on maosh_harakatlar (kechikish_id) where kechikish_id is not null and not bekor;

comment on column maosh_harakatlar.kechikish_id is
  'Avtomatik jarima manbai — ustoz_kechikish.id (0100). Kechikish o''chsa yoki o''zgarsa, jarima bekor qilinadi.';

create or replace function kechikish_jarima_stavka() returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select (qiymat #>> '{}')::numeric from settings where kalit = 'maosh.kechikish_jarima'), 5000)
$$;

/* Bitta kechikish uchun jarima yozish */
create or replace function kechikish_jarima_yoz(k ustoz_kechikish) returns void
language plpgsql security definer set search_path = public as $$
begin
  if maosh_oy_qulfmi(to_char(k.sana, 'YYYY-MM')) then
    return;  -- tasdiqlangan oyga tegilmaydi
  end if;
  insert into maosh_harakatlar (teacher_id, davr, turi, summa, izoh, kechikish_id, kiritgan)
  values (k.teacher_id, to_char(k.sana, 'YYYY-MM'), 'jarima', k.daqiqa * kechikish_jarima_stavka(),
          format('Kechikish: %s, %s daqiqa × %s%s', to_char(k.sana, 'DD.MM'), k.daqiqa,
                 kechikish_jarima_stavka()::bigint,
                 coalesce(' · ' || (select g.nom from groups g where g.id = k.group_id), '')),
          k.id, k.kiritdi)
  on conflict do nothing;
end;
$$;

/* Kechikishning amaldagi jarimasini bekor qilish */
create or replace function kechikish_jarima_bekor(p_id uuid, p_sabab text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update maosh_harakatlar
     set bekor = true, bekor_sabab = p_sabab
   where kechikish_id = p_id and not bekor
     and not maosh_oy_qulfmi(davr);
end;
$$;

create or replace function ustoz_kechikish_jarima() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform kechikish_jarima_bekor(old.id, 'Kechikish bekor qilindi');
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if new.daqiqa is not distinct from old.daqiqa and new.sana is not distinct from old.sana
       and new.teacher_id is not distinct from old.teacher_id and new.group_id is not distinct from old.group_id then
      return new;
    end if;
    perform kechikish_jarima_bekor(old.id, 'Kechikish o''zgartirildi');
  end if;
  perform kechikish_jarima_yoz(new);
  return new;
end;
$$;

-- O'chirishda BEFORE: FK yo'q, lekin kechikish_id hali mavjud paytda bekor qilinsin
drop trigger if exists ustoz_kechikish_jarima_del on ustoz_kechikish;
create trigger ustoz_kechikish_jarima_del before delete on ustoz_kechikish
  for each row execute function ustoz_kechikish_jarima();
drop trigger if exists ustoz_kechikish_jarima_iu on ustoz_kechikish;
create trigger ustoz_kechikish_jarima_iu after insert or update on ustoz_kechikish
  for each row execute function ustoz_kechikish_jarima();

revoke execute on function kechikish_jarima_yoz(ustoz_kechikish) from public, anon, authenticated;
revoke execute on function kechikish_jarima_bekor(uuid, text) from public, anon, authenticated;
revoke execute on function kechikish_jarima_stavka() from public, anon;
grant execute on function kechikish_jarima_stavka() to authenticated;

-- Hozirgi (tasdiqlanmagan oylardagi) kechikishlarga jarima
select kechikish_jarima_yoz(k) from ustoz_kechikish k
where not exists (select 1 from maosh_harakatlar m where m.kechikish_id = k.id and not m.bekor);
