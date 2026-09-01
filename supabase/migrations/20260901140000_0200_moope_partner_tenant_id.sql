-- 0200 — id da locadora na conexão, para provisionar sem colar chave.
--
-- A locadora chama POST /provision com o userid dela. Na segunda vez
-- o CRM reabre o mesmo tenant em vez de nascer outro.

alter table public.moope_connections
  add column if not exists partner_tenant_id text;

comment on column public.moope_connections.partner_tenant_id is
  'userid da locadora que pediu este tenant. Unique quando preenchido.';

create unique index if not exists uniq_moope_connections_partner_tenant
  on public.moope_connections (partner_tenant_id)
  where partner_tenant_id is not null;
