-- 0053: woblar berish/olish ham audit_log ga tushadi —
-- "ustoz X o'quvchi Y ga N woblar berdi" Audit bo'limida ko'rinadi.
-- woblar_ber RPC va admin/ustoz to'g'ridan-to'g'ri yozuvlari — hammasi trigger orqali.

drop trigger if exists woblr_audit on woblr;
create trigger woblr_audit after insert or update or delete on woblr
  for each row execute function audit_trigger();
