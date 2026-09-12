-- 0205 — campanha comercial mínima.
--
-- Por que tabela própria: não existe campanha no repo. Não reutilizar
-- `lib/moope/enviar.ts` / `operational_moope` (Gestão → cliente), automação
-- conversacional nem alerta interno do atendente.
--
-- A mensagem real, quando existir, continua em `messages` via
-- campaign_recipients.message_id. Nesta rodada o envio é MOCK: não cria
-- conversation/message, não gera QR, não fala com WhatsApp.

create table if not exists public.campaigns (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  status text not null default 'draft',
  channel_session_id uuid references public.channel_sessions(id) on delete set null,
  template_id uuid,
  body_text text not null default '',
  segment jsonb not null default '{}'::jsonb,
  created_by_user_id uuid,
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_status_check
    check (status in ('draft', 'scheduled', 'running', 'completed', 'cancelled', 'failed')),
  constraint campaigns_name_len check (char_length(name) between 1 and 120)
);

create index if not exists idx_campaigns_org_status
  on public.campaigns (organization_id, status, created_at desc);

create table if not exists public.campaign_recipients (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  phone text,
  status text not null default 'pending',
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  replied_at timestamptz,
  failed_at timestamptz,
  error text,
  lead_id uuid references public.crm_leads(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint campaign_recipients_status_check
    check (status in (
      'pending', 'skipped', 'sent', 'delivered', 'read', 'replied', 'failed', 'cancelled'
    )),
  constraint campaign_recipients_unique unique (campaign_id, contact_id)
);

create index if not exists idx_campaign_recipients_org_campaign
  on public.campaign_recipients (organization_id, campaign_id, status);

create index if not exists idx_campaign_recipients_org_contact
  on public.campaign_recipients (organization_id, contact_id, status);

alter table public.campaigns enable row level security;
alter table public.campaign_recipients enable row level security;

drop policy if exists tenant_isolation_campaigns_all on public.campaigns;
create policy tenant_isolation_campaigns_all
  on public.campaigns
  for all
  using (
    (organization_id in (select public.fn_user_org_ids())
      and public.fn_role_at_least(organization_id, 'agent'))
    or public.fn_is_platform_admin()
  )
  with check (
    (organization_id in (select public.fn_user_org_ids())
      and public.fn_role_at_least(organization_id, 'agent'))
    or public.fn_is_platform_admin()
  );

drop policy if exists tenant_isolation_campaign_recipients_all
  on public.campaign_recipients;
create policy tenant_isolation_campaign_recipients_all
  on public.campaign_recipients
  for all
  using (
    (organization_id in (select public.fn_user_org_ids())
      and public.fn_role_at_least(organization_id, 'agent'))
    or public.fn_is_platform_admin()
  )
  with check (
    (organization_id in (select public.fn_user_org_ids())
      and public.fn_role_at_least(organization_id, 'agent'))
    or public.fn_is_platform_admin()
  );

comment on table public.campaigns is
  'Campanha comercial do tenant. Não é disparo operacional MOOPE nem alerta interno.';
comment on table public.campaign_recipients is
  'Destinatário da campanha. unique (campaign_id, contact_id) = no máximo um envio lógico. message_id aponta para messages quando houver mensagem real.';
