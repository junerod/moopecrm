import type {
  PackAutomationSeed,
  PackCampaignSeed,
  PackFollowupSeed,
  PackQuickReplySeed,
} from "@/lib/business-packs/tipos";

/** Rótulos do funil — o runtime não lê o id do Pack. */
export type VocabularioDeFluxo = {
  quem: string;
  proposta: string;
  agendamento: string;
  ganho: string;
  /** Textos do modelo operacional — um jeito de usar por tipo de negócio. */
  modelo?: {
    message: string;
    message_2: string;
    como_usar: string;
    primeiro_passo: string;
  };
};

export function tituloDoTemplateDoFluxo(key: string, parte: 1 | 2 = 1): string {
  return parte === 1 ? `pack-fluxo:${key}` : `pack-fluxo:${key}:2`;
}

export function titulosDosTemplatesDoFluxo(
  seed: Pick<PackFollowupSeed, "key" | "message_2">,
): string[] {
  return seed.message_2
    ? [tituloDoTemplateDoFluxo(seed.key), tituloDoTemplateDoFluxo(seed.key, 2)]
    : [tituloDoTemplateDoFluxo(seed.key)];
}

export function fluxoModeloDoPack(v: VocabularioDeFluxo): PackFollowupSeed {
  const texto = v.modelo ?? {
    message: `Olá. Enviamos as condições ${v.quem}. Conseguiu olhar? Qualquer dúvida administrativa, respondo por aqui.`,
    message_2:
      "Olá. Passando de novo só para não perder o fio. Se ainda fizer sentido, me diga o próximo passo. Se não for o momento, pode responder que paramos.",
    como_usar:
      "Revise os dois textos, ligue o fluxo e use o quadro de verdade: proposta enviada = card nessa etapa. Não invente preço nem condição — o recado só cobra retorno.",
    primeiro_passo: `Você move o card para “${v.proposta}” quando a cotação ou a proposta sai.`,
  };
  return {
    key: "modelo-operacao",
    name: `Modelo: depois de ${v.proposta}`,
    description:
      "Exemplo completo do seu negócio: espera, confere se o card ainda está na etapa e só então manda. Se a pessoa responder ou o card sair, para.",
    kind: "stage_change",
    stage_name: v.proposta,
    wait_minutes: 120,
    wait2_minutes: 480,
    com_condicao: true,
    destaque: true,
    message: texto.message,
    message_2: texto.message_2,
    passos: [
      texto.primeiro_passo,
      "O sistema espera 2 horas. Se o cliente já respondeu, não mexe.",
      `Confere: o card ainda está em “${v.proposta}”? Se já foi para outra coluna, para.`,
      "Manda o primeiro recado (o texto é seu).",
      "Espera mais 8 horas e confere de novo.",
      "Se ainda não houve resposta, manda o segundo recado e encerra.",
    ],
    como_usar: texto.como_usar,
  };
}

export function fluxosProntosDoPack(v: VocabularioDeFluxo): PackFollowupSeed[] {
  return [
    fluxoModeloDoPack(v),
    {
      key: "silencio-2h",
      name: "Novo contato sem resposta — 2 horas",
      description: "Se o time não responder, o sistema manda este recado. Se a pessoa responder, para.",
      kind: "silence",
      threshold_minutes: 120,
      message: `Olá. Recebemos sua mensagem ${v.quem}. Em breve uma pessoa do time continua com você.`,
    },
    {
      key: "apos-proposta",
      name: `Follow-up depois de ${v.proposta}`,
      description: "Quando o card entra nessa etapa, espera e pergunta se deu para avaliar.",
      kind: "stage_change",
      stage_name: v.proposta,
      wait_minutes: 120,
      message: "Olá. Conseguiu olhar as condições que enviamos? Qualquer dúvida, respondo por aqui.",
    },
    {
      key: "lembrete-agenda",
      name: `Confirmação de ${v.agendamento}`,
      description: "Quando o card entra nessa etapa, confirma o horário com o texto que você editar.",
      kind: "stage_change",
      stage_name: v.agendamento,
      wait_minutes: 30,
      message: "Olá. Confirmando seu horário. Se precisar remarcar, é só responder esta mensagem.",
    },
    {
      key: "satisfacao",
      name: `Pesquisa depois de ${v.ganho}`,
      description: "Quando o negócio fecha, pede um retorno simples. Sem nota, sem diagnóstico.",
      kind: "stage_change",
      stage_name: v.ganho,
      wait_minutes: 120,
      message: `Olá. Como foi sua experiência ${v.quem}? Sua resposta nos ajuda a melhorar.`,
    },
  ];
}

export function automacoesPadraoDoPack(v?: Partial<VocabularioDeFluxo>): PackAutomationSeed[] {
  return [
    {
      key: "lead-sem-resposta",
      name: "Novo lead sem resposta humana",
      description: "Marca o contato novo que ainda não teve retorno do time.",
      trigger_event: "message.received",
      followup_minutes: 120,
      actions: [{ type: "add_tag", config: { tags: ["aguardando_retorno"] } }],
    },
    {
      key: "followup-proposta",
      name: "Follow-up de proposta",
      description: "Marca quem entrou na etapa de proposta ou orçamento.",
      trigger_event: "lead.stage_changed",
      stage_name: v?.proposta,
      actions: [{ type: "add_tag", config: { tags: ["proposta_enviada"] } }],
    },
    {
      key: "lembrete",
      name: "Lembrete de retorno",
      description: "Marca quem entrou na etapa de agenda ou confirmação.",
      trigger_event: "lead.stage_changed",
      stage_name: v?.agendamento,
      actions: [{ type: "add_tag", config: { tags: ["aguardando_retorno"] } }],
    },
    {
      key: "documento-pendente",
      name: "Documento pendente",
      description: "Marca o contato novo para o time pedir o que falta.",
      trigger_event: "lead.created",
      actions: [{ type: "add_tag", config: { tags: ["documentos_pendentes"] } }],
    },
    {
      key: "reativacao",
      name: "Reativação de contato",
      description: "Marca contato novo que voltou depois de um tempo.",
      trigger_event: "lead.created",
      actions: [{ type: "add_tag", config: { tags: ["reativar"] } }],
    },
    {
      key: "satisfacao",
      name: "Pesquisa de satisfação",
      description: "Marca quem chegou na etapa de ganho para o time pedir retorno.",
      trigger_event: "lead.stage_changed",
      stage_name: v?.ganho,
      actions: [{ type: "add_tag", config: { tags: ["cliente"] } }],
    },
    {
      key: "followup-consulta",
      name: "Follow-up após atendimento",
      description: "Marca quem passou da etapa de atendimento para o retorno.",
      trigger_event: "lead.stage_changed",
      stage_name: v?.agendamento,
      actions: [{ type: "add_tag", config: { tags: ["aguardando_retorno"] } }],
    },
    {
      key: "retorno-agendado",
      name: "Retorno agendado",
      description: "Marca quem ficou de voltar.",
      trigger_event: "lead.stage_changed",
      stage_name: v?.ganho,
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
