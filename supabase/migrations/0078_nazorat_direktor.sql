-- ============================================================
--  0078 — Nazorat xabarlari direktorga faqat o'zi yoqsa (Jamshid, 18.10)
-- ============================================================
--  Avval: manager yo'q bo'lsa Telegram direktorga ketardi, sayt
--  bildirishnomasi ({"rol":"manager"}) direktorga ham chiqardi.
--  Endi: faqat managerlarga; direktorga — settings
--  'nazorat.direktorga' = true bo'lsa (standart — false). Almashtirgichni
--  faqat direktor bosadi (Nazorat sahifasida).
-- ============================================================

insert into settings (kalit, qiymat, tavsif)
values ('nazorat.direktorga', 'false'::jsonb, 'Nazorat xabarlari (sayt + Telegram) direktorga ham borsinmi. Faqat direktor o''zgartiradi.')
on conflict (kalit) do nothing;

create or replace function nazorat_direktorga() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (qiymat #>> '{}')::boolean from settings
                   where kalit = 'nazorat.direktorga' and jsonb_typeof(qiymat) = 'boolean'), false)
$$;
revoke execute on function nazorat_direktorga() from public, anon;
grant execute on function nazorat_direktorga() to authenticated, service_role;

create or replace function nazorat_direktorga_ozgartir(p_yoq boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not app_is_direktor() then
    raise exception 'Bu sozlamani faqat direktor o''zgartiradi.';
  end if;
  update settings set qiymat = to_jsonb(coalesce(p_yoq, false)), updated_at = now()
  where kalit = 'nazorat.direktorga';
  return coalesce(p_yoq, false);
end;
$$;
revoke execute on function nazorat_direktorga_ozgartir(boolean) from public, anon;
grant execute on function nazorat_direktorga_ozgartir(boolean) to authenticated, service_role;

/* Telegram: ustoz/xodim — o'zi; ikkalasi bo'sh — managerlar (+ direktor, yoqilgan bo'lsa) */
create or replace function nazorat_chatlar(p_teacher text, p_profile uuid)
returns bigint[]
language plpgsql stable security definer set search_path = public as $$
declare
  v_r bigint[];
begin
  if auth.uid() is not null and not app_is_manager() then
    raise exception 'Faqat manager yoki direktor.';
  end if;
  if p_teacher is not null then
    select array_agg(distinct u.chat_id) into v_r
    from telegram_ulanish u
    where u.holat = 'faol'
      and (u.teacher_id = p_teacher or u.profile_id = (select profile_id from teachers where id = p_teacher));
  elsif p_profile is not null then
    select array_agg(distinct u.chat_id) into v_r
    from telegram_ulanish u where u.holat = 'faol' and u.profile_id = p_profile;
  else
    select array_agg(distinct u.chat_id) into v_r
    from telegram_ulanish u join profiles p on p.id = u.profile_id
    where u.holat = 'faol' and p.holat = 'faol'
      and (p.rol = 'manager' or (p.rol = 'direktor' and nazorat_direktorga()));
  end if;
  return coalesce(v_r, '{}');
end;
$$;

/* Sayt bildirishnomasi {"rol":"manager"} — manager; direktor faqat yoqqan bo'lsa */
do $$
declare
  v_def text := pg_get_functiondef('bildirishnoma_menga(text[], jsonb)'::regprocedure);
begin
  if v_def like '%if v_rolf = ''manager'' then return app_is_manager(); end if;%' then
    execute replace(v_def,
      'if v_rolf = ''manager'' then return app_is_manager(); end if;',
      'if v_rolf = ''manager'' then return app_rol() = ''manager'' or (app_is_direktor() and nazorat_direktorga()); end if;');
  else
    raise exception 'bildirishnoma_menga kutilgan ko''rinishda emas (0077 qo''llanganmi?)';
  end if;
end $$;
