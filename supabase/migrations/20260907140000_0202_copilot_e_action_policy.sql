-- 0202 — Copilot (sugestão sem side effect) + Action Policy (confirmação).
--
-- job_queue.kind ganha `copilot_turn`. NÃO é turno conversacional: não fala
-- com o lead. O CHECK de coerência exige contact_id (a sugestão é de uma
-- conversa). A lista de kinds no baseline é UM bloco só — esta migration
-- amplia a constraint; o baseline edita o bloco único, não reconstrói.

alter table job_queue drop constraint if exists job_queue_kind_check;
alter table job_queue add constraint job_queue_kind_check
  check (kind in (
    'inbound_turn','followup_turn','watchdog','flywheel',
    'case_reply_turn','operator_turn','copilot_turn'
  ));

alter table job_queue drop constraint if exists job_queue_turn_needs_contact;
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'job_queue'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%contact_id is not null%';
  if c is not null then execute format('alter table job_queue drop constraint %I', c); end if;
end $$;
alter table job_queue add constraint job_queue_turn_needs_contact
  check ((kind in (
    'inbound_turn','followup_turn','case_reply_turn','operator_turn','copilot_turn'
  )) = (contact_id is not null));

create table if not exists public.ai_copilot_suggestions (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  agent_id uuid,
  inbound_message_id uuid not null references public.messages(id) on delete cascade,
  summary text not null,
  intent text not null,
  suggested_reply text not null default '',
  suggested_next_action text,
  extracted_fields jsonb not null default '{}'::jsonb,
  confidence numeric not null default 0,
  status text not null default 'ready',
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_copilot_suggestions_status_check
    check (status in ('ready', 'discarded', 'used')),
  constraint ai_copilot_suggestions_confidence_check
    check (confidence >= 0 and confidence <= 1),
  constraint ai_copilot_suggestions_msg_unique
    unique (organization_id, conversation_id, inbound_message_id)
);

create index if not exists idx_ai_copilot_suggestions_org_conv
  on public.ai_copilot_suggestions (organization_id, conversation_id, created_at desc);

create table if not exists public.ai_action_requests (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  contact_id uuid,
  lead_id uuid,
  agent_id uuid,
  requested_action text not null,
  payload jsonb not null default '{}'::jsonb,
  policy_result text not null,
  status text not null default 'pending',
  idempotency_key text not null,
  confirmed_by uuid,
  executed_by uuid,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_action_requests_status_check
    check (status in ('pending', 'confirmed', 'denied', 'executed', 'failed')),
  constraint ai_action_requests_key_unique
    unique (organization_id, idempotency_key)
);

create index if not exists idx_ai_action_requests_org_conv
  on public.ai_action_requests (organization_id, conversation_id, created_at desc);

alter table public.ai_copilot_suggestions enable row level security;
alter table public.ai_action_requests enable row level security;

drop policy if exists tenant_isolation_ai_copilot_suggestions_all on public.ai_copilot_suggestions;
create policy tenant_isolation_ai_copilot_suggestions_all
  on public.ai_copilot_suggestions
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

drop policy if exists tenant_isolation_ai_action_requests_all on public.ai_action_requests;
create policy tenant_isolation_ai_action_requests_all
  on public.ai_action_requests
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

comment on table public.ai_copilot_suggestions is
  'Sugestão do Copilot por mensagem inbound. unique (org, conversa, mensagem) é a idempotência.';
comment on table public.ai_action_requests is
  'Pedido de ação CONTROLLED que exige confirmação humana. unique (org, idempotency_key).';
