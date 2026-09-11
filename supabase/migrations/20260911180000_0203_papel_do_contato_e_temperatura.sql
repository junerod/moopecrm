-- 0203 — papel da pessoa e temperatura humana do negócio.
--
-- Papel é do CONTATO (equipe / lead / cliente / ignorado). Temperatura é do LEAD
-- (frio / morno / quente), escrita por gente. Não reusa ai_probability_band:
-- aquele nome é score de IA; gravar na mão mentiria a coluna.
--
-- O UPDATE de display_name anula lixo de canal (título de 404, HTML, frase
-- longa demais para nome). Não inventa nome de pessoa.

alter table public.contacts
  add column if not exists papel text;

alter table public.crm_leads
  add column if not exists temperatura text;

update public.contacts
   set display_name = null, updated_at = now()
 where display_name is not null
   and (
     display_name ilike '%haven''t found what I''m looking for%'
     or display_name ilike '%<html%'
     or display_name ilike '%<!doctype%'
     or length(btrim(display_name)) > 80
   );

alter table public.contacts drop constraint if exists contacts_papel_check;
alter table public.contacts
  add constraint contacts_papel_check
  check (papel is null or papel = any (array['equipe'::text, 'lead'::text, 'cliente'::text, 'ignorado'::text]));

do $$
begin

  if not exists (
    select 1 from pg_constraint
     where conname = 'crm_leads_temperatura_check'
       and conrelid = 'public.crm_leads'::regclass
  ) then
    alter table public.crm_leads
      add constraint crm_leads_temperatura_check
      check (temperatura is null or temperatura = any (array['frio'::text, 'morno'::text, 'quente'::text]));
  end if;
end $$;

create index if not exists idx_contacts_org_papel
  on public.contacts (organization_id, papel)
  where papel is not null;

comment on column public.contacts.papel is
  'Quem é esta pessoa para o atendimento: equipe, lead, cliente ou ignorado. Null = ainda não classificada.';
comment on column public.crm_leads.temperatura is
  'Temperatura humana do negócio (frio/morno/quente). Independente do score de IA.';
