-- 0199 — URL da API da locadora (GET lookup / retrato).
--
-- O webhook de eventos (partner_webhook_url) não é a base da API:
-- costuma ser /api/crm/events/:id. Sem este campo o CRM usa a origem
-- do webhook; o operador pode gravar a base certa se for outro host.

alter table public.moope_connections
  add column if not exists partner_api_url text;

comment on column public.moope_connections.partner_api_url is
  'Base da API do parceiro para GET lookup/retrato. Sem isto, a origem do webhook.';
