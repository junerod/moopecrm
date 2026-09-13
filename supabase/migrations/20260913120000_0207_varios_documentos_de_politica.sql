-- 0207 — vários documentos de política por agente.
--
-- `ai_knowledge_sources_unique_per_agent` (agent_id, source_type) WHERE is_active
-- garantia UMA FAQ, UMA política, UM catálogo. A Central de Conhecimento precisa
-- de N PDFs ativos. FAQ / conversas / catálogo continuam singleton.
-- Sem esta troca, o segundo upload quebrava com 23505 e a UI mentia "erro
-- interno".

drop index if exists public.ai_knowledge_sources_unique_per_agent;

create unique index if not exists ai_knowledge_sources_unique_per_agent
  on public.ai_knowledge_sources using btree (agent_id, source_type)
  where is_active and source_type <> 'policy';

comment on index public.ai_knowledge_sources_unique_per_agent is
  'Uma fonte ativa por tipo e agente, exceto policy (N documentos). Migration 0207.';
