-- 0213: upload de foto, vídeo e áudio.
-- O storage API assume o papel do JWT (service_role) e lê storage.buckets.
-- Sem GRANT, todo upload responde "permission denied for table buckets".
-- Acontece quando uma versão nova do storage recria as tabelas como
-- supabase_storage_admin e os grants do init não voltam.
-- Idempotente. Se o papel corrente não pode conceder, avisa e segue.

do $$
begin
  execute 'grant usage on schema storage to postgres, anon, authenticated, service_role';
  execute 'grant all on all tables in schema storage to postgres, anon, authenticated, service_role';
  execute 'grant all on all sequences in schema storage to postgres, anon, authenticated, service_role';
  execute 'grant all on all routines in schema storage to postgres, anon, authenticated, service_role';
  execute 'alter default privileges for role supabase_storage_admin in schema storage grant all on tables to postgres, anon, authenticated, service_role';
  execute 'alter default privileges for role supabase_storage_admin in schema storage grant all on sequences to postgres, anon, authenticated, service_role';
  execute 'alter default privileges for role supabase_storage_admin in schema storage grant all on functions to postgres, anon, authenticated, service_role';
exception
  when insufficient_privilege then
    raise notice '0213: grants de storage exigem supabase_admin; papel atual sem privilegio';
end $$;
