import type { BusinessPackDefinition } from "@/lib/business-packs/tipos";
import { DEFINITION_ADVOCACIA } from "@/lib/ready-models/modelos/advocacia";

const VOZ_BASE =
  "Você atende em nome da empresa configurada — nunca de outra marca. " +
  "Uma conversa só: você é uma especialidade interna, o cliente fala com um único atendente. " +
  "Não invente andamento processual, número de processo, prazo, decisão judicial, jurisprudência, honorário nem estratégia jurídica. " +
  "Não prometa resultado. Não apresente inferência como informação do advogado. " +
  "Se a pergunta exigir análise jurídica profissional, encaminhe para um advogado. " +
  "Knowledge só explica material fornecido pelo escritório e cita a fonte quando aplicável. " +
  "Se não houver Knowledge ou dado confiável, pergunte ou encaminhe para uma pessoa.";

export const PACK_ESCRITORIO_ADVOCACIA: BusinessPackDefinition = {
  id: "escritorio_advocacia",
  version: "1.0",
  label: "Escritório de advocacia",
  description:
    "Organize novos atendimentos, clientes, documentos, retornos e relacionamento.",
  ready_model_id: "advocacia",
  pipeline: {
    nome: "COMERCIAL — ESCRITÓRIO",
    etapas: [
      { nome: "Novo contato", passo: "new" },
      { nome: "Triagem", passo: "contacted" },
      { nome: "Qualificado", passo: "qualifying" },
      { nome: "Consulta agendada", passo: "qualified" },
      { nome: "Proposta enviada", passo: null },
      { nome: "Em negociação", passo: "negotiating" },
      { nome: "Contratado", passo: "won" },
      { nome: "Não contratado", passo: "lost" },
    ],
  },
  fields: DEFINITION_ADVOCACIA.fields,
  vocabulary: {
    lead: "Cliente",
    deal: "Caso",
    won: "Contratado",
    lost: "Não contratado",
  },
  collections: [
    { slug: "atendimento-do-escritorio", name: "Atendimento do Escritório" },
    { slug: "areas-de-atuacao", name: "Áreas de Atuação" },
    { slug: "documentos-e-procedimentos", name: "Documentos e Procedimentos" },
    { slug: "comercial-e-honorarios", name: "Comercial e Honorários" },
    { slug: "relacionamento", name: "Relacionamento" },
  ],
  specialties: [
    {
      key: "recepcao",
      name: "Atendimento do Escritório",
      description:
        "Recebe, entende o assunto, identifica se é cliente ou novo contato, coleta dados iniciais e encaminha.",
      is_default: true,
      collection_slugs: ["atendimento-do-escritorio", "areas-de-atuacao"],
      tool_ids: [],
      voice:
        VOZ_BASE +
        " Você é a recepção e triagem. Entenda se é cliente ou novo contato, colete o mínimo (nome, assunto, cidade) e encaminhe. " +
        "Não dê orientação jurídica. Se estiver incerto, pergunte ou chame uma pessoa.",
    },
    {
      key: "comercial",
      name: "Novos Clientes",
      description:
        "Qualificação inicial, área de interesse, origem, agendamento e follow-up de proposta ou consulta.",
      collection_slugs: ["comercial-e-honorarios", "areas-de-atuacao", "atendimento-do-escritorio"],
      tool_ids: [],
      voice:
        VOZ_BASE +
        " Você qualifica novos clientes. Entenda área de interesse, origem e urgência. " +
        "Sugira agendar consulta ou reunião. Honorários só se houver fonte cadastrada. " +
        "Nunca prometa resultado nem invente valor.",
    },
    {
      key: "atendimento",
      name: "Atendimento ao Cliente",
      description:
        "Orientações administrativas, documentos necessários, agendamento e encaminhamento.",
      collection_slugs: ["atendimento-do-escritorio", "documentos-e-procedimentos"],
      tool_ids: [],
      voice:
        VOZ_BASE +
        " Você atende quem já é cliente. Oriente só o lado administrativo. " +
        "Andamento, prazo e decisão judicial: se não houver fonte, encaminhe para o advogado. " +
        "Não invente número de processo.",
    },
    {
      key: "documentos",
      name: "Documentos e Pendências",
      description:
        "Pede documentos faltantes, explica checklist documental e confirma recebimento quando o sistema souber.",
      collection_slugs: ["documentos-e-procedimentos", "atendimento-do-escritorio"],
      tool_ids: [],
      voice:
        VOZ_BASE +
        " Você cuida da checklist documental. Só liste documentos que o escritório cadastrou. " +
        "Sem fonte, não invente lista específica. Confirme recebimento só quando o sistema registrar.",
    },
    {
      key: "financeiro",
      name: "Financeiro do Escritório",
      description:
        "Informações administrativas sobre honorários, parcelas, vencimentos e links somente com fonte confiável.",
      collection_slugs: ["comercial-e-honorarios", "atendimento-do-escritorio"],
      tool_ids: [],
      voice:
        VOZ_BASE +
        " Você trata do financeiro administrativo. Honorário, parcela e vencimento só com fonte oficial. " +
        'Sem dado confiável, diga: "Não consegui consultar essa informação agora." Não invente valor.',
    },
    {
      key: "relacionamento",
      name: "Relacionamento",
      description: "Follow-up, satisfação, retorno, reativação e comunicação geral.",
      collection_slugs: ["relacionamento", "atendimento-do-escritorio"],
      tool_ids: [],
      voice:
        VOZ_BASE +
        " Você cuida de follow-up e relacionamento. Não dispare campanha sem configuração e consentimento. " +
        "Não invente prazo jurídico nem resultado de processo.",
    },
  ],
  intents: [
    {
      name: "saudacao",
      description: "Cumprimento ou abertura de conversa.",
      examples: ["oi", "olá, boa tarde", "quero falar com vocês"],
      keywords: ["oi", "ola", "olá", "bom dia", "boa tarde", "boa noite"],
      specialty_key: "recepcao",
    },
    {
      name: "falar_advogado",
      description: "Pedido para falar com advogado.",
      examples: ["Quero falar com um advogado sobre meu caso."],
      keywords: ["falar com um advogado", "falar com advogado", "meu caso", "advogado"],
      specialty_key: "recepcao",
    },
    {
      name: "agendar_consulta",
      description: "Marcar consulta ou reunião.",
      examples: ["Quero marcar uma consulta.", "podemos agendar um horário"],
      keywords: ["marcar uma consulta", "agendar", "consulta", "reunião", "horario"],
      specialty_key: "comercial",
    },
    {
      name: "qualificacao",
      description: "Novo interessado em contratar.",
      examples: ["preciso de um advogado trabalhista", "quero contratar o escritório"],
      keywords: ["contratar", "preciso de um advogado", "area de", "trabalhista", "familia"],
      specialty_key: "comercial",
    },
    {
      name: "documentos",
      description: "Quais documentos levar ou enviar.",
      examples: ["Quais documentos preciso levar?", "o que preciso enviar"],
      keywords: ["documentos preciso", "quais documentos", "documentos", "checklist"],
      specialty_key: "documentos",
    },
    {
      name: "honorario",
      description: "Pergunta de honorário ou preço.",
      examples: ["Quanto custa?", "qual o valor dos honorários"],
      keywords: ["quanto custa", "honorario", "honorário", "preco", "preço", "valor"],
      specialty_key: "financeiro",
    },
    {
      name: "andamento",
      description: "Pedido de andamento processual.",
      examples: ["Como está meu processo?", "qual o andamento"],
      keywords: ["como esta meu processo", "andamento", "meu processo", "numero do processo"],
      specialty_key: "atendimento",
    },
    {
      name: "decisao",
      description: "Pergunta sobre decisão judicial.",
      examples: ["Qual foi a decisão do juiz?", "o juiz já decidiu"],
      keywords: ["decisao do juiz", "decisão do juiz", "juiz", "sentenca", "sentença"],
      specialty_key: "atendimento",
    },
    {
      name: "prazo",
      description: "Pergunta de prazo jurídico.",
      examples: ["qual o prazo para recorrer", "quando vence o prazo"],
      keywords: ["prazo para", "prazo do", "vence o prazo"],
      specialty_key: "atendimento",
    },
    {
      name: "jurisprudencia",
      description: "Pedido de jurisprudência ou tese.",
      examples: ["qual a jurisprudência nesse caso"],
      keywords: ["jurisprudencia", "jurisprudência", "tese", "precedente"],
      specialty_key: "atendimento",
    },
    {
      name: "proposta",
      description: "Proposta ou condições de contratação.",
      examples: ["enviei a proposta?", "quais as condições administrativas"],
      keywords: ["proposta", "contratacao", "contratação", "condicoes"],
      specialty_key: "comercial",
    },
    {
      name: "followup",
      description: "Retorno ou reativação.",
      examples: ["estou passando para saber se avaliou", "faz tempo que não falamos"],
      keywords: ["avaliar as informacoes", "faz tempo", "voltar a falar", "satisfacao"],
      specialty_key: "relacionamento",
    },
  ],
  quick_replies: [
    {
      key: "boas-vindas",
      title: "Boas-vindas",
      body: "Olá, {{nome}}. Sou do atendimento do escritório. Como podemos ajudar?",
    },
    {
      key: "triagem",
      title: "Triagem",
      body: "Para encaminhar seu atendimento corretamente, pode me contar resumidamente o que aconteceu?",
    },
    {
      key: "agendamento",
      title: "Agendamento",
      body: "Podemos agendar um horário para conversar com nossa equipe.",
    },
    {
      key: "documentos",
      title: "Documentos",
      body: "Vou lhe enviar a relação de documentos necessários para darmos continuidade.",
    },
    {
      key: "recebimento",
      title: "Recebimento",
      body: "Recebemos sua mensagem. Nossa equipe está analisando e retornará assim que possível.",
    },
    {
      key: "proposta",
      title: "Proposta",
      body: "Enviei as informações da contratação. Se quiser, posso esclarecer as condições administrativas.",
    },
    {
      key: "follow-up",
      title: "Follow-up",
      body: "Olá, {{nome}}. Estou passando para saber se conseguiu avaliar as informações que enviamos.",
    },
    {
      key: "humano",
      title: "Enviar para humano",
      body: "Vou te passar para uma pessoa do time continuar daqui. Um momento.",
    },
  ],
  automations: [
    {
      key: "lead-sem-resposta",
      name: "Novo lead sem resposta humana",
      trigger_event: "message.received",
      followup_minutes: 120,
      actions: [{ type: "add_tag", config: { tags: ["aguardando_retorno"] } }],
    },
    {
      key: "followup-consulta",
      name: "Follow-up após consulta",
      trigger_event: "lead.stage_changed",
      actions: [{ type: "add_tag", config: { tags: ["aguardando_retorno"] } }],
    },
    {
      key: "followup-proposta",
      name: "Follow-up de proposta",
      trigger_event: "lead.stage_changed",
      actions: [{ type: "add_tag", config: { tags: ["proposta_enviada"] } }],
    },
    {
      key: "lembrete-consulta",
      name: "Lembrete de consulta",
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
      key: "retorno-agendado",
      name: "Retorno agendado",
      trigger_event: "lead.stage_changed",
      actions: [{ type: "add_tag", config: { tags: ["aguardando_retorno"] } }],
    },
    {
      key: "reativacao",
      name: "Reativação de contato",
      trigger_event: "lead.created",
      actions: [{ type: "add_tag", config: { tags: ["nao_contratado"] } }],
    },
    {
      key: "satisfacao",
      name: "Pesquisa de satisfação",
      trigger_event: "lead.stage_changed",
      actions: [{ type: "add_tag", config: { tags: ["cliente"] } }],
    },
  ],
  campaigns: [
    {
      key: "novidade-escritorio",
      title: "Conte uma novidade do escritório",
      body: "Olá! Temos uma novidade do escritório para compartilhar. Se quiser saber mais, é só responder esta mensagem.",
    },
    {
      key: "reativar-contato",
      title: "Reativar contato antigo",
      body: "Olá, {{nome}}. Faz um tempo que não nos falamos. Se ainda precisar de ajuda, estamos à disposição.",
    },
    {
      key: "atualizacao-cadastral",
      title: "Lembrete de atualização cadastral",
      body: "Para mantermos seu atendimento em dia, pode confirmar se seus dados de contato continuam corretos?",
    },
    {
      key: "informativa",
      title: "Campanha informativa",
      body: "Compartilhamos uma informação do escritório. Se tiver dúvida administrativa, responda por aqui.",
    },
    {
      key: "satisfacao",
      title: "Pesquisa de satisfação",
      body: "Como foi sua experiência com o atendimento do escritório? Sua resposta nos ajuda a melhorar.",
    },
    {
      key: "convite-consulta",
      title: "Convite para consulta",
      body: "Podemos agendar um horário para conversar com nossa equipe. Qual período fica melhor para você?",
    },
    {
      key: "comunicado",
      title: "Comunicado importante",
      body: "Temos um comunicado do escritório. Se quiser detalhes, responda esta mensagem e uma pessoa do time segue com você.",
    },
  ],
  capabilities: [
    { key: "clientes", label: "Clientes", tool_id: null, read: false, write: false },
    { key: "processos", label: "Andamento processual", tool_id: null, read: false, write: false },
    { key: "financeiro", label: "Honorários e parcelas", tool_id: null, read: false, write: false },
    { key: "documentos", label: "Documentos", tool_id: null, read: false, write: false },
  ],
  ai_mode_default: "copilot",
};
