-- Bot visual no quadro de automações (purpose no pointer).
-- Default 'followup' — clones antigos não mudam. O gatilho inbound vive no
-- jsonb trigger_config (Zod), não numa coluna: o schema só precisa do propósito
-- para listar Bots sem misturar com lembrete de silêncio.

alter table public.followup_flow_pointers
  add column if not exists purpose text not null default 'followup';

update public.followup_flow_pointers
  set purpose = 'followup'
  where purpose is null or btrim(purpose) = '';

alter table public.followup_flow_pointers
  drop constraint if exists followup_flow_pointers_purpose_check;

alter table public.followup_flow_pointers
  add constraint followup_flow_pointers_purpose_check
  check (purpose in ('followup', 'bot'));

create index if not exists idx_followup_flow_pointers_org_purpose
  on public.followup_flow_pointers (organization_id, purpose);

comment on column public.followup_flow_pointers.purpose is
  'followup = lembrete/silêncio; bot = porta da frente (menu, FAQ, horário). Default followup.';
