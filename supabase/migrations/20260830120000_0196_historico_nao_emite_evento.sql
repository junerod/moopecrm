-- ============================================================================
-- 0196 — Mensagem trazida do aparelho NÃO é acontecimento novo.
--
-- O importador grava o legado em `messages` com metadata.historico = true.
-- Sem esta guarda, o gatilho AFTER INSERT emite `message.received` para cada
-- linha, e os quatro consumidores (agente, sentimento, automação, follow-up)
-- tratam cliente de meses atrás como se tivesse acabado de escrever.
--
-- A marca só existe no caminho do importador. A ingestão ao vivo não a põe,
-- então mensagem nova continua emitindo exatamente como antes.
-- ============================================================================

create or replace function public.fn_emit_message_event() returns trigger
    language plpgsql
    set search_path to 'public', 'pg_temp'
    as $$
declare
  v_event text;
begin
  if coalesce(new.metadata->>'historico', '') = 'true' then
    return new;
  end if;

  if new.direction = 'inbound' then
    v_event := 'message.received';
  else
    v_event := case new.status
                 when 'sending' then 'message.sending'
                 when 'sent' then 'message.sent'
                 when 'failed' then 'message.failed'
                 else 'message.outbound'
               end;
  end if;

  perform public.fn_log_event(
    new.organization_id, v_event,
    jsonb_build_object(
      'message_id', new.id, 'conversation_id', new.conversation_id,
      'contact_id', new.contact_id, 'direction', new.direction,
      'type', new.type, 'status', new.status, 'external_id', new.external_id,
      'channel_session_id', new.channel_session_id,
      'body_preview', left(new.body, 280)
    )
  );
  return new;
end$$;
