-- 0198 — a chave de cifra sai do .env e entra no banco.
--
-- `fn_encrypt_oauth` lê `private.app_secrets.nuvemshop_oauth_key` (ou a
-- GUC). O kit da VPS semeia isso no install/update. O Supabase local e
-- o clone que só copiou `.env.local` não — e a tela de criar conexão
-- MOOPE (e Nuvemshop, webhook, Google) devolve 422 "Cifra indisponível".
--
-- Esta RPC é o que o app chama ANTES de cifrar, com o valor do env.
-- `on conflict do nothing`: trocar a chave invalidaria o que já está
-- cifrado. Quem precisa rotacionar faz isso no kit, não no tempo da
-- requisição.

create or replace function public.fn_seed_oauth_key(p_value text)
returns boolean
language plpgsql
security definer
set search_path to 'private', 'pg_temp'
as $$
begin
  if p_value is null or length(p_value) < 32 then
    return false;
  end if;
  insert into private.app_secrets (name, value)
  values ('nuvemshop_oauth_key', p_value)
  on conflict (name) do nothing;
  return exists (
    select 1
      from private.app_secrets
     where name = 'nuvemshop_oauth_key'
       and length(value) >= 32
  );
end;
$$;

revoke execute on function public.fn_seed_oauth_key(text) from public, anon, authenticated;
grant execute on function public.fn_seed_oauth_key(text) to service_role;

comment on function public.fn_seed_oauth_key(text) is
  'Semeia private.app_secrets.nuvemshop_oauth_key a partir do env. Só service_role. Não sobrescreve chave existente.';
