/**
 * O que o nó Humano pede quando a conversa sai do bot.
 * A frase vai ao cliente (isso é o `phrase` do nó). Aqui mora o que a EQUIPE vê:
 * o comentário e, se alguém foi escolhido, a conversa cai para essa pessoa.
 */
export type PedidoDePessoa = {
  userId?: string;
  note?: string;
};

export function corpoDoAviso(entrada: {
  note?: string;
  encaminhou: boolean;
  assignFalhou: boolean;
}): { title: string; body: string } {
  const nota = entrada.note?.trim();
  const partes = [nota || "O quadro de atendimento passou a conversa para um humano."];
  if (entrada.encaminhou && !entrada.assignFalhou) {
    partes.push("A conversa foi para a pessoa escolhida neste passo.");
  }
  if (entrada.assignFalhou) {
    partes.push("Não deu para colocar na pessoa escolhida. A conversa ficou na Central.");
  }
  return { title: "O bot pediu uma pessoa", body: partes.join(" ") };
}

type ContatoDoAviso = {
  organization_id: string;
  contact_id: string;
  conversation_id: string | null;
};

/**
 * Marca o contato, tenta entregar a conversa e abre a Central.
 * Falha ao entregar NÃO apaga o aviso: a equipe ainda precisa ver o pedido.
 */
export async function gravarAvisoDePessoa(
  db: {
    marcarHumano(orgId: string, contactId: string): Promise<void>;
    atribuir(orgId: string, conversationId: string, userId: string): Promise<void>;
    abrirCentral(item: {
      organization_id: string;
      title: string;
      body: string;
      ref_id: string;
    }): Promise<void>;
  },
  contato: ContatoDoAviso,
  pedido?: PedidoDePessoa,
): Promise<void> {
  await db.marcarHumano(contato.organization_id, contato.contact_id);
  const userId = pedido?.userId?.trim() || undefined;
  const podeEncaminhar = Boolean(userId && contato.conversation_id);
  let assignFalhou = false;
  if (podeEncaminhar && userId && contato.conversation_id) {
    try {
      await db.atribuir(contato.organization_id, contato.conversation_id, userId);
    } catch {
      assignFalhou = true;
    }
  }
  const aviso = corpoDoAviso({
    note: pedido?.note,
    encaminhou: podeEncaminhar,
    assignFalhou,
  });
  await db.abrirCentral({
    organization_id: contato.organization_id,
    title: aviso.title,
    body: aviso.body,
    ref_id: contato.contact_id,
  });
}
