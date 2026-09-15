-- 0210 — quinto canal: Direct (transporte Instagram Messaging).
--
-- Mesma ordem da 0201: coluna de ref ANTES do CHECK. CHECKs RECRIADOS
-- (drop + add): um clone já tem a versão de quatro providers.
-- `duplicate_object` engoliria a versão nova e o canal novo seria recusado
-- com update.sh verde.

alter table public.channel_sessions
  add column if not exists instagram_account_id text;

alter table public.channel_sessions
  drop constraint if exists channel_sessions_provider_check;

alter table public.channel_sessions
  add constraint channel_sessions_provider_check
  check (provider = any (array[
    'waha'::text,
    'meta_cloud'::text,
    'zernio'::text,
    'twilio'::text,
    'instagram'::text
  ]));

alter table public.channel_sessions
  drop constraint if exists channel_sessions_provider_ref_check;

alter table public.channel_sessions
  add constraint channel_sessions_provider_ref_check check (
    (provider = 'waha'       and waha_session_name     is not null) or
    (provider = 'meta_cloud' and meta_phone_number_id  is not null) or
    (provider = 'zernio'     and zernio_account_id     is not null) or
    (provider = 'twilio'     and twilio_from           is not null) or
    (provider = 'instagram'  and instagram_account_id  is not null)
  );

comment on column public.channel_sessions.instagram_account_id is
  'IG user id da conta profissional. É o sessionRef deste canal. Espelhado em lib/channels/session-ref.ts.';

-- Uma conta ativa por instalação. Arquivado pode reconectar a mesma.
create unique index if not exists channel_sessions_instagram_account_id_ativo_unique
  on public.channel_sessions (instagram_account_id)
  where archived_at is null and instagram_account_id is not null;
