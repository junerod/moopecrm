-- Inbound numa conversa encerrada devolve ela para a fila.
-- Sem isto, "fechar em massa" engole a próxima mensagem do cliente:
-- fn_upsert_wa_conversation não mexe em status, e a aba Fila só lista open/pending.

create or replace function public.fn_mark_conversation_message(
  p_conv uuid, p_direction text, p_preview text, p_at timestamptz
) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set
    status = case
      when p_direction = 'inbound' and status in ('closed', 'archived', 'resolved') then 'open'
      else status
    end,
    status_changed_at = case
      when p_direction = 'inbound' and status in ('closed', 'archived', 'resolved') then now()
      else status_changed_at
    end,
    assigned_to_user_id = case
      when p_direction = 'inbound' and status in ('closed', 'archived', 'resolved') then null
      else assigned_to_user_id
    end,
    assignee_kind = case
      when p_direction = 'inbound' and status in ('closed', 'archived', 'resolved') then null
      else assignee_kind
    end,
    assigned_at = case
      when p_direction = 'inbound' and status in ('closed', 'archived', 'resolved') then null
      else assigned_at
    end,
    last_message_at = p_at,
    last_message_preview = p_preview,
    last_inbound_at  = case when p_direction = 'inbound'  then p_at else last_inbound_at  end,
    last_outbound_at = case when p_direction = 'outbound' then p_at else last_outbound_at end,
    unread_count_for_assignee = case
      when p_direction = 'inbound'  then unread_count_for_assignee + 1
      when p_direction = 'outbound' then 0
      else unread_count_for_assignee
    end,
    updated_at = now()
  where id = p_conv;
end; $$;

comment on function public.fn_mark_conversation_message is
  'Atualiza agregados da conversa. Inbound incrementa unread e, se a conversa estava encerrada, devolve ela para a fila (open, sem dono). Outbound zera unread.';

revoke execute on function public.fn_mark_conversation_message(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.fn_mark_conversation_message(uuid, text, text, timestamptz) to service_role;
