-- 0197 — conexão MOOPE (chave + eventos) por organização.
--
-- Um protocolo só, dois kinds (locadora | juridico). Tabela irmã de
-- tenant_integrations de propósito: o CHECK de provider com 'nuvemshop'
-- exigiria migration no enum velho, e a Nuvemshop continua no schema
-- porque a cifra (fn_encrypt_oauth / GUC app.nuvemshop_oauth_key) é
-- compartilhada com WAHA e webhooks.
--
-- inbound_key_hash: o parceiro manda Bearer; plaintext uma vez, hash
-- SHA256 depois — o molde das api_tokens.
-- outbound_secret_enc: o CRM precisa do segredo para assinar HMAC de
-- saída, então cifra (fn_encrypt_oauth), não hash.
--
-- Idempotência de evento inbound: unique (organization_id, external_id)
-- em moope_inbound_events. Sem isto o Asaas da locadora reenvia e o
-- Kanban duplica.

create table if not exists public.moope_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('locadora', 'juridico')),
  partner_webhook_url text,
  inbound_key_prefix text not null,
  inbound_key_hash text not null,
  outbound_secret_enc bytea,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid,
  unique (organization_id),
  unique (inbound_key_hash)
);

create table if not exists public.moope_inbound_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.moope_connections(id) on delete cascade,
  external_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, external_id)
);

create index if not exists idx_moope_inbound_events_org_created
  on public.moope_inbound_events (organization_id, created_at desc);

alter table public.moope_connections enable row level security;
alter table public.moope_inbound_events enable row level security;

drop policy if exists "tenant_isolation_moope_connections_all" on public.moope_connections;
drop policy if exists "tenant_isolation_moope_connections_select" on public.moope_connections;
create policy "tenant_isolation_moope_connections_select" on public.moope_connections
  for select using (
    organization_id in (select public.fn_user_org_ids())
    or public.fn_is_platform_admin()
  );

drop policy if exists "tenant_isolation_moope_connections_write" on public.moope_connections;
create policy "tenant_isolation_moope_connections_write" on public.moope_connections
  for all using (
    (organization_id in (select public.fn_user_org_ids())
      and public.fn_role_at_least(organization_id, 'admin'))
    or public.fn_is_platform_admin()
  )
  with check (
    (organization_id in (select public.fn_user_org_ids())
      and public.fn_role_at_least(organization_id, 'admin'))
    or public.fn_is_platform_admin()
  );

drop policy if exists "tenant_isolation_moope_inbound_events_all" on public.moope_inbound_events;
create policy "tenant_isolation_moope_inbound_events_all" on public.moope_inbound_events
  for select using (
    (organization_id in (select public.fn_user_org_ids()))
    or public.fn_is_platform_admin()
  );

comment on table public.moope_connections is
  'Uma conexão por organização com um produto MOOPE (frota ou Facejus). Chave de entrada em hash; segredo de saída cifrado.';
comment on table public.moope_inbound_events is
  'Eventos que o parceiro mandou. unique (organization_id, external_id) impede card duplicado no reenvio.';
