import type { PackAutomationSeed, PackCampaignSeed, PackQuickReplySeed } from "@/lib/business-packs/tipos";

export function automacoesPadraoDoPack(): PackAutomationSeed[] {
  return [
    {
      key: "lead-sem-resposta",
      name: "Novo lead sem resposta humana",
      trigger_event: "message.received",
      followup_minutes: 120,
      actions: [{ type: "add_tag", config: { tags: ["aguardando_retorno"] } }],
    },
    {
      key: "followup-proposta",
      name: "Follow-up de proposta",
      trigger_event: "lead.stage_changed",
      actions: [{ type: "add_tag", config: { tags: ["proposta_enviada"] } }],
    },
    {
      key: "lembrete",
      name: "Lembrete de retorno",
      trigger_event: "lead.stage_changed",
      actions: [{ type: "add_tag", config: { tags: ["aguardando_retorno"] } }],
    },
    {
      key: "documento-pendente",
      name: "Documento pendente",
      trigger_event: "lead.created",
      actions: [{ type: "add_tag", config: { tags: ["documentos_pendentes"] } }],
    },
    {
      key: "reativacao",
      name: "Reativação de contato",
      trigger_event: "lead.created",
      actions: [{ type: "add_tag", config: { tags: ["reativar"] } }],
    },
    {
      key: "satisfacao",
      name: "Pesquisa de satisfação",
      trigger_event: "lead.stage_changed",
      actions: [{ type: "add_tag", config: { tags: ["cliente"] } }],
    },
    {
      key: "followup-consulta",
      name: "Follow-up após atendimento",
      trigger_event: "lead.stage_changed",
      actions: [{ type: "add_tag", config: { tags: ["aguardando_retorno"] } }],
    },
    {
      key: "retorno-agendado",
      name: "Retorno agendado",
      trigger_event: "lead.stage_changed",
      actions: [{ type: "add_tag", config: { tags: ["aguardando_retorno"] } }],
    },
  ];
}

export function respostasPadrao(quem: string): PackQuickReplySeed[] {
  return [
    {
      key: "boas-vindas",
      title: "Boas-vindas",
      body: `Olá, {{nome}}. Sou do atendimento ${quem}. Como podemos ajudar?`,
    },
    {
      key: "triagem",
      title: "Triagem",
      body: "Para encaminhar corretamente, pode me contar resumidamente o que você precisa?",
    },
    {
      key: "agendamento",
      title: "Agendamento",
      body: "Podemos agendar um horário com a equipe. Qual período fica melhor?",
    },
    {
      key: "documentos",
      title: "Documentos",
      body: "Vou enviar a relação de documentos necessários para darmos continuidade.",
    },
    {
      key: "recebimento",
      title: "Recebimento",
      body: "Recebemos sua mensagem. Nossa equipe analisa e retorna em breve.",
    },
    {
      key: "proposta",
      title: "Proposta",
      body: "Enviei as informações comerciais. Se quiser, esclareço as condições administrativas.",
    },
    {
      key: "follow-up",
      title: "Follow-up",
      body: "Olá, {{nome}}. Estou passando para saber se conseguiu avaliar o que enviamos.",
    },
    {
      key: "humano",
      title: "Enviar para humano",
      body: "Vou te passar para uma pessoa do time continuar daqui. Um momento.",
    },
  ];
}

export function campanhasPadrao(quem: string): PackCampaignSeed[] {
  return [
    {
      key: "novidade",
      title: "Novidade",
      body: `Olá! Temos uma novidade ${quem} para compartilhar. Se quiser saber mais, responda esta mensagem.`,
    },
    {
      key: "reativar-contato",
      title: "Reativar contato antigo",
      body: "Olá, {{nome}}. Faz um tempo que não nos falamos. Se ainda precisar, estamos à disposição.",
    },
    {
      key: "atualizacao-cadastral",
      title: "Atualização cadastral",
      body: "Pode confirmar se seus dados de contato continuam corretos?",
    },
    {
      key: "informativa",
      title: "Campanha informativa",
      body: `Compartilhamos uma informação ${quem}. Se tiver dúvida, responda por aqui.`,
    },
    {
      key: "satisfacao",
      title: "Pesquisa de satisfação",
      body: "Como foi sua experiência com o atendimento? Sua resposta nos ajuda a melhorar.",
    },
    {
      key: "convite",
      title: "Convite para conversar",
      body: "Podemos agendar um horário com a equipe. Qual período fica melhor para você?",
    },
    {
      key: "comunicado",
      title: "Comunicado importante",
      body: "Temos um comunicado. Se quiser detalhes, responda e uma pessoa do time segue com você.",
    },
  ];
}
