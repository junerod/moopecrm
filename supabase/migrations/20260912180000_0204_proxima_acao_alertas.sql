-- 0204 — telefone de alerta do atendente + ledger de lembretes da próxima ação.
--
-- Por que migration (e não tabela `tasks`): a obrigação comercial JÁ vive em
-- `demandas.proximo_passo` + `proximo_passo_em`. O que faltava era (A) o
-- telefone PARTICULAR do atendente (não o do cliente) e (B) um registro de
-- entrega para o reminder ser idempotente.
--
-- Este envio é INTERNO (`alerta_interno_atendente`). Não é conversa CRM,
-- campanha, takeover nem `operational_moope` (Gestão → cliente).

alter table public.user_organizations
  add column if not exists alert_whatsapp_phone text;

alter table public.user_organizations
  add column if not exists alert_proxima_acao boolean not null default false;

alter table public.user_organizations
  add column if not exists alert_antecedencia_min integer not null default 30;

alter table public.user_organizations
  drop constraint if exists user_organizations_alert_antecedencia_check;
alter table public.user_organizations
  add constraint user_organizations_alert_antecedencia_check
  check (alert_antecedencia_min in (10, 30, 60));

comment on column public.user_organizations.alert_whatsapp_phone is
  'E.164 do WhatsApp PARTICULAR do atendente para lembretes internos. Nunca o telefone do cliente.';
comment on column public.user_organizations.alert_proxima_acao is
  'Opt-in: receber alerta interno de próxima ação. Default desligado.';
comment on column public.user_organizations.alert_antecedencia_min is
  'Minutos de antecedência do alerta pre_due: 10, 30 ou 60.';

create table if not exists public.demanda_alert_deliveries (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  demanda_id uuid not null references public.demandas(id) on delete cascade,
  kind text not null,
  scheduled_for timestamptz not null,
  dest_e164 text not null,
  created_at timestamptz not null default now(),
  constraint demanda_alert_deliveries_kind_check
    check (kind in ('pre_due', 'overdue')),
  constraint demanda_alert_deliveries_unique
    unique (organization_id, demanda_id, kind, scheduled_for)
);

create index if not exists idx_demanda_alert_deliveries_org_demanda
  on public.demanda_alert_deliveries (organization_id, demanda_id);

alter table public.demanda_alert_deliveries enable row level security;

drop policy if exists tenant_isolation_demanda_alert_deliveries_all
  on public.demanda_alert_deliveries;
create policy tenant_isolation_demanda_alert_deliveries_all
  on public.demanda_alert_deliveries
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

comment on table public.demanda_alert_deliveries is
  'Ledger de alerta INTERNO ao atendente. unique (org, demanda, kind, scheduled_for) = no máximo uma entrega lógica. scheduled_for é o vencimento da ação — reagendar muda a chave.';
