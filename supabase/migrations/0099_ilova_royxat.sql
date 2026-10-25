-- ============================================================
--  0099 — "Ilovani o'rnatganlar" hisobotida ismlar ro'yxati (Jamshid, 25.10)
-- ============================================================
--  hisobot_ilova() ga 'royxat' qo'shiladi: har odam — ism, rol, qurilmalari
--  (iphone/android/kompyuter), birinchi va oxirgi ochgan vaqti.
--  Faqat xodim ko'radi (tekshiruv o'sha-o'sha).
-- ============================================================

create or replace function hisobot_ilova()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not app_is_staff() then
    raise exception 'Hisobot faqat xodimlar uchun.';
  end if;
  return (
    with q as (
      select i.*, p.rol, p.ism from ilova_qurilmalar i join profiles p on p.id = i.profile_id
    )
    select jsonb_build_object(
      'odam',       (select count(distinct profile_id) from q),
      'qurilma',    (select count(*) from q),
      'hafta',      (select count(distinct profile_id) from q where oxirgi > now() - interval '7 days'),
      'rollar',     coalesce((select jsonb_object_agg(rol, n) from (
                      select rol, count(distinct profile_id) n from q group by rol) r), '{}'::jsonb),
      'platformalar', coalesce((select jsonb_object_agg(platforma, n) from (
                      select platforma, count(*) n from q group by platforma) r), '{}'::jsonb),
      'boshlangan', (select min(birinchi) from q),
      'royxat',     coalesce((select jsonb_agg(jsonb_build_object(
                        'ism', x.ism, 'rol', x.rol, 'platformalar', x.platformalar,
                        'birinchi', x.birinchi, 'oxirgi', x.oxirgi) order by x.oxirgi desc)
                      from (
                        select profile_id, max(ism) as ism, max(rol::text) as rol,
                               array_agg(distinct platforma order by platforma) as platformalar,
                               min(birinchi) as birinchi, max(oxirgi) as oxirgi
                        from q group by profile_id
                      ) x), '[]'::jsonb)
    )
  );
end;
$$;
revoke execute on function hisobot_ilova() from public, anon;
grant execute on function hisobot_ilova() to authenticated;
