-- ============================================================
--  0089 — Taklif: vitrinadagi TUGAGAN mahsulotni qayta so'rash (Jamshid, 24.10)
-- ============================================================
--  Taklif formasida uchinchi variant — "Tugagan mahsulot". O'quvchi
--  vitrinada turgan, lekin tugagan mahsulotni tanlaydi va boshqa hech narsa
--  yozmaydi: nom va rasm mahsulotdan olinadi, mahsulot_id bog'lanadi.
--  Mahsulot faol va tugaganligi server action'da tekshiriladi.
-- ============================================================

alter table woblr_takliflar
  add column if not exists mahsulot_id uuid references woblr_rewards (id) on delete set null;

alter table woblr_takliflar drop constraint if exists woblr_takliflar_qachon_check;
alter table woblr_takliflar add constraint woblr_takliflar_qachon_check
  check (qachon in ('keyingi_bozor', 'umumiy', 'tugagan'));

create index if not exists woblr_takliflar_mahsulot_idx on woblr_takliflar (mahsulot_id) where mahsulot_id is not null;

-- Taklif mazmuni (mahsulot_id ham) xodim tomonidan o'zgartirilmaydi.
-- mahsulot_id faqat mahsulot o'chirilganda (on delete set null) null bo'lishi mumkin.
create or replace function taklif_ozgarish() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.student_id is distinct from old.student_id or new.nom is distinct from old.nom
     or new.tavsif is distinct from old.tavsif or new.havola is distinct from old.havola
     or new.rasm_url is distinct from old.rasm_url or new.taxminiy_narx is distinct from old.taxminiy_narx
     or new.qachon is distinct from old.qachon or new.izoh is distinct from old.izoh
     or (new.mahsulot_id is distinct from old.mahsulot_id and new.mahsulot_id is not null)
     or new.created_at is distinct from old.created_at then
    raise exception 'Taklif mazmunini o''zgartirib bo''lmaydi — faqat holat va javob.';
  end if;
  new.updated_at := now();
  new.korib_chiqdi := coalesce(auth.uid(), new.korib_chiqdi);
  return new;
end;
$$;
