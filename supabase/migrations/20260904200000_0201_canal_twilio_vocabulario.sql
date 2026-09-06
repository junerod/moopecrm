-- 0201 — vocabulário do quarto canal (mensagens hospedadas / Content API).
--
-- Mesma ordem da 0131: tipo + CHECK + coluna de ref ANTES do transporte.
-- Coluna NOVA `twilio_from`: o identificador é o número WhatsApp no provedor
-- (dígitos E.164), não o Account SID — um SID pode ter vários senders, e
-- reusar `zernio_account_id` mentiria sobre o espaço de id.
--
-- CHECKs RECRIADOS (drop + add): um clone já tem a versão de três providers.
-- `duplicate_object` engoliria a versão nova e o canal novo seria recusado
-- com update.sh verde.

alter table public.channel_sessions
  add column if not exists twilio_from text;

alter table public.channel_sessions
  add column if not exists twilio_account_sid text;

alter table public.channel_sessions
  add column if not exists twilio_token_encrypted text;

alter table public.channel_sessions
  drop constraint if exists channel_sessions_provider_check;

alter table public.channel_sessions
  add constraint channel_sessions_provider_check
  check (provider = any (array['waha'::text, 'meta_cloud'::text, 'zernio'::text, 'twilio'::text]));

alter table public.channel_sessions
  drop constraint if exists channel_sessions_provider_ref_check;

alter table public.channel_sessions
  add constraint channel_sessions_provider_ref_check check (
    (provider = 'waha'       and waha_session_name    is not null) or
    (provider = 'meta_cloud' and meta_phone_number_id is not null) or
    (provider = 'zernio'     and zernio_account_id    is not null) or
    (provider = 'twilio'     and twilio_from          is not null)
  );

comment on column public.channel_sessions.twilio_from is
  'Número WhatsApp deste sender no provedor, só dígitos E.164. É o sessionRef. Espelhado em lib/channels/session-ref.ts.';

comment on column public.channel_sessions.twilio_account_sid is
  'Account SID da API de mensagens. Autentica; não identifica o sender.';

-- Um sender ativo por instalação. Arquivado pode reconectar o mesmo número.
create unique index if not exists channel_sessions_twilio_from_ativo_unique
  on public.channel_sessions (twilio_from)
  where archived_at is null and twilio_from is not null;
