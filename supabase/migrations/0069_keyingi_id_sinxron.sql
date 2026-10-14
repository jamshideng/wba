-- ============================================================
-- 0069 — Sheets ↔ sayt sinxron (14.10): o'quvchi ID to'qnashmasin
--
-- Sheets'da 2 fanli bola — 2 qator, 2 ID (S050, S112). Saytda bitta
-- o'quvchi (S050), ikkinchi ID esa faqat yozilishning sheets_id'sida
-- qoladi. keyingi_id faqat students.id ni ko'rardi — sayt S112 ni
-- yangi bolaga berib yuborishi mumkin edi. Endi yozilish ID'lari ham
-- band hisoblanadi.
-- ============================================================

create or replace function keyingi_id(p_jadval text, p_prefiks text, p_uzunlik int default 3)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_max int;
  v_yoz int;
begin
  if p_jadval not in ('students', 'groups', 'teachers') then
    raise exception 'Noma''lum jadval: %', p_jadval;
  end if;
  if p_prefiks !~ '^[A-Z]{1,3}$' then
    raise exception 'Prefiks faqat katta harflar: %', p_prefiks;
  end if;

  perform pg_advisory_xact_lock(hashtext('keyingi_id:' || p_jadval));

  execute format(
    'select coalesce(max(substring(id from %s)::int), 0) from %I where id ~ %L',
    length(p_prefiks) + 1, p_jadval, '^' || p_prefiks || '[0-9]+$'
  ) into v_max;

  if p_jadval = 'students' then
    select coalesce(max(substring(sheets_id from length(p_prefiks) + 1)::int), 0) into v_yoz
    from enrollments where sheets_id ~ ('^' || p_prefiks || '[0-9]+$');
    v_max := greatest(v_max, v_yoz);
  end if;

  return p_prefiks || lpad((v_max + 1)::text, p_uzunlik, '0');
end;
$$;
