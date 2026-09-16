import { fluxosProntosDoPack } from "@/lib/business-packs/sementes";
import type { BusinessPackDefinition } from "@/lib/business-packs/tipos";
import { definitionLocacao } from "@/lib/ready-models/modelos/locacao";

const VOZ_BASE =
  "Você atende em nome da empresa configurada — nunca de outra marca. " +
  "Uma conversa só: você é uma especialidade interna, o cliente fala com um único atendente. " +
  "Não invente preço, diária, caução, franquia, disponibilidade, boleto, vencimento nem placa. " +
  "Se não houver Knowledge ou consulta operacional, pergunte ou encaminhe para uma pessoa.";

export const PACK_LOCADORA_VEICULOS: BusinessPackDefinition = {
  id: "locadora_veiculos",
  version: "1.0",
  label: "Locadora de veículos",
  description:
    "Atendimento, vendas, disponibilidade, cobranças, pós-locação e relacionamento com clientes.",
  ready_model_id: "locacao",
  ready_model_subtype: "veiculos",
  pipeline: {
    nome: "COMERCIAL — LOCADORA",
    etapas: [
      { nome: "Novo lead", passo: "new" },
      { nome: "Em atendimento", passo: "contacted" },
      { nome: "Qualificado", passo: "qualifying" },
      { nome: "Cotação / Proposta", passo: "qualified" },
      { nome: "Negociação", passo: "negotiating" },
      { nome: "Reserva / Documentação", passo: null },
      { nome: "Fechado — Locação", passo: "won" },
      { nome: "Perdido", passo: "lost" },
    ],
  },
  fields: definitionLocacao("veiculos").fields,
  vocabulary: {
    lead: "Lead",
    deal: "Locação",
    won: "Fechado — Locação",
    lost: "Perdido",
  },
  collections: [
    { slug: "suporte-da-locadora", name: "SUPORTE DA LOCADORA" },
    { slug: "comercial-da-locadora", name: "COMERCIAL DA LOCADORA" },
    { slug: "politicas-e-contratos", name: "POLÍTICAS E CONTRATOS" },
    { slug: "conhecimento-geral", name: "CONHECIMENTO GERAL" },
  ],
  specialties: [
    {
      key: "recepcao",
      name: "Atendimento da Locadora",
      description: "Entende a intenção, identifica lead ou cliente e encaminha.",
      is_default: true,
      collection_slugs: ["conhecimento-geral", "comercial-da-locadora"],
      tool_ids: ["moope_lookup_locatario", "moope_get_atendimento"],
      voice:
        VOZ_BASE +
        " Você é a recepção. Entenda se é lead ou cliente, colete o mínimo (nome, período, cidade) e encaminhe. " +
        "Não invente informação operacional. Se estiver incerto, pergunte ou chame uma pessoa.",
    },
    {
      key: "comercial",
      name: "Consultor Comercial",
      description: "Qualifica interessados, registra oportunidade e avança o funil quando permitido.",
      collection_slugs: ["comercial-da-locadora", "conhecimento-geral"],
      tool_ids: ["moope_listar_oferta"],
      voice:
        VOZ_BASE +
        " Você é o consultor comercial. Entenda período, datas, cidade/unidade, categoria e finalidade. " +
        "Qualifique, registre a oportunidade e sugira o próximo passo. " +
        "Diferenciais e políticas vêm do Knowledge. Disponibilidade só após consulta real. " +
        "Nunca prometa veículo sem consulta operacional.",
    },
    {
      key: "financeiro",
      name: "Assistente Financeiro",
      description: "Orienta sobre cobrança. Valores vêm da gestão, nunca da memória.",
      collection_slugs: ["politicas-e-contratos", "conhecimento-geral"],
      tool_ids: ["moope_lookup_locatario", "moope_get_retrato"],
      voice:
        VOZ_BASE +
        " Você é o assistente financeiro. Valor, vencimento, status e boleto são dados operacionais. " +
        "Nunca responda com memória. Sem ferramenta ou dado oficial, diga: " +
        '"Não consegui consultar essa informação agora."',
    },
    {
      key: "disponibilidade",
      name: "Assistente de Disponibilidade",
      description: "Consulta frota quando a gestão existir; senão coleta o pedido.",
      collection_slugs: ["comercial-da-locadora", "conhecimento-geral"],
      tool_ids: ["moope_listar_oferta"],
      voice:
        VOZ_BASE +
        " Você consulta disponibilidade. Nunca afirme estoque sem consulta real. " +
        "Sem integração, colete período, categoria e cidade e encaminhe ao comercial.",
    },
    {
      key: "atendimento",
      name: "Atendimento ao Cliente",
      description: "Dúvidas durante a locação, devolução, pane e documentação.",
      collection_slugs: ["suporte-da-locadora", "politicas-e-contratos", "conhecimento-geral"],
      tool_ids: ["moope_lookup_locatario", "moope_get_retrato"],
      voice:
        VOZ_BASE +
        " Você atende quem já está com o veículo. Procedimento vem do Knowledge. " +
        "Dados da locação vêm da gestão. Pane, sinistro e multa: escale para uma pessoa.",
    },
    {
      key: "relacionamento",
      name: "Relacionamento",
      description: "Leads parados, clientes antigos e follow-up — sem disparar campanha sozinho.",
      collection_slugs: ["comercial-da-locadora", "conhecimento-geral"],
      tool_ids: [],
      voice:
        VOZ_BASE +
        " Você cuida de reativação e relacionamento. Não dispare campanha sem configuração e consentimento. " +
        "Sugira próximo passo; não invente oferta nem preço.",
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
      name: "quero_alugar",
      description: "Novo interessado em locação.",
      examples: ["quero alugar um carro", "preciso de um veículo para viajar"],
      keywords: ["quero alugar", "alugar um", "alugar carro", "locar", "reservar um"],
      specialty_key: "comercial",
    },
    {
      name: "orcamento",
      description: "Pedido de orçamento.",
      examples: ["quanto fica um sedan por uma semana", "me passa um orçamento"],
      keywords: ["orcamento", "orçamento", "cotacao", "cotação", "proposta"],
      specialty_key: "comercial",
    },
    {
      name: "preco",
      description: "Pergunta de preço.",
      examples: ["qual o valor da diária", "quanto custa"],
      keywords: ["preco", "preço", "valor", "diaria", "diária", "quanto custa", "quanto fica"],
      specialty_key: "comercial",
    },
    {
      name: "disponibilidade",
      description: "Consulta se há veículo no período.",
      examples: ["tem SUV disponível", "tem carro para amanhã"],
      keywords: ["disponivel", "disponível", "tem suv", "tem carro", "frota", "vaga"],
      specialty_key: "disponibilidade",
    },
    {
      name: "boleto",
      description: "Segunda via ou boleto.",
      examples: ["preciso da segunda via do meu boleto"],
      keywords: ["boleto", "segunda via"],
      specialty_key: "financeiro",
    },
    {
      name: "pix",
      description: "Pagamento via PIX.",
      examples: ["me manda o pix"],
      keywords: ["pix"],
      specialty_key: "financeiro",
    },
    {
      name: "segunda_via",
      description: "Segunda via de cobrança.",
      examples: ["segunda via da parcela"],
      keywords: ["segunda via"],
      specialty_key: "financeiro",
    },
    {
      name: "vencimento",
      description: "Data de vencimento.",
      examples: ["qual o vencimento da minha próxima parcela"],
      keywords: ["vencimento", "vence", "parcela"],
      specialty_key: "financeiro",
    },
    {
      name: "pagamento",
      description: "Situação de pagamento.",
      examples: ["está em atraso meu pagamento"],
      keywords: ["pagamento", "paguei", "atraso", "cobranca", "cobrança"],
      specialty_key: "financeiro",
    },
    {
      name: "problema_carro",
      description: "Pane ou problema no veículo.",
      examples: ["o carro quebrou", "bati o carro"],
      keywords: ["quebrou", "bati", "pane", "problema no carro", "nao liga", "não liga"],
      specialty_key: "atendimento",
    },
    {
      name: "manutencao",
      description: "Manutenção ou revisão.",
      examples: ["preciso de manutenção"],
      keywords: ["manutencao", "manutenção", "revisao", "revisão"],
      specialty_key: "atendimento",
    },
    {
      name: "sinistro",
      description: "Sinistro / acidente.",
      examples: ["bati o carro. o que faço?"],
      keywords: ["sinistro", "acidente", "bati o carro", "colid"],
      specialty_key: "atendimento",
    },
    {
      name: "multa",
      description: "Multa de trânsito.",
      examples: ["recebi uma multa"],
      keywords: ["multa"],
      specialty_key: "atendimento",
    },
    {
      name: "devolucao",
      description: "Devolução do veículo.",
      examples: ["quando posso devolver", "quero devolver o carro"],
      keywords: ["devolver", "devolucao", "devolução"],
      specialty_key: "atendimento",
    },
    {
      name: "prorrogacao",
      description: "Prorrogar a locação.",
      examples: ["quero prorrogar minha locação"],
      keywords: ["prorrogar", "prorrogacao", "prorrogação", "estender", "renovar"],
      specialty_key: "atendimento",
    },
    {
      name: "cliente_antigo",
      description: "Cliente que já alugou.",
      examples: ["já aluguei com vocês"],
      keywords: ["ja aluguei", "já aluguei", "cliente antigo", "de novo"],
      specialty_key: "relacionamento",
    },
    {
      name: "nova_locacao",
      description: "Nova locação de quem já é cliente.",
      examples: ["quero alugar de novo"],
      keywords: ["alugar de novo", "nova locacao", "nova locação"],
      specialty_key: "relacionamento",
    },
    {
      name: "reativacao",
      description: "Voltar a negociar.",
      examples: ["voltei a precisar de um carro"],
      keywords: ["voltei", "reativar", "faz tempo"],
      specialty_key: "relacionamento",
    },
  ],
  quick_replies: [
    {
      key: "saudacao",
      title: "Saudação",
      body: "Olá! Aqui é o atendimento da {{org_name}}. Como posso ajudar hoje?",
    },
    {
      key: "periodo",
      title: "Solicitar período",
      body: "Para te ajudar melhor: de qual data até qual data você precisa do veículo?",
    },
    {
      key: "categoria",
      title: "Solicitar categoria",
      body: "Qual categoria ou modelo você prefere? (hatch, sedan, SUV, utilitário…)",
    },
    {
      key: "documentos",
      title: "Documentos necessários",
      body: "Vou confirmar com a equipe quais documentos pedimos nesta locação e já te retorno.",
    },
    {
      key: "aguardar",
      title: "Aguardar consulta",
      body: "Estou consultando isso agora. Já te retorno com a informação oficial.",
    },
    {
      key: "humano",
      title: "Enviar para humano",
      body: "Vou te passar para uma pessoa do time continuar daqui. Um momento.",
    },
    {
      key: "fora_horario",
      title: "Fora do horário",
      body: "Estamos fora do horário de atendimento. Assim que o time voltar, seguimos com você.",
    },
    {
      key: "boleto_indisponivel",
      title: "Boleto indisponível",
      body: "Não consegui consultar essa informação agora. Uma pessoa do financeiro te ajuda em seguida.",
    },
    {
      key: "veiculo_indisponivel",
      title: "Veículo indisponível",
      body: "Não consigo afirmar disponibilidade agora. Vou registrar seu pedido e o comercial te retorna.",
    },
    {
      key: "confirmacao",
      title: "Confirmação de atendimento",
      body: "Certo, estou com o seu pedido. Qualquer novidade eu te aviso por aqui.",
    },
    {
      key: "encerramento",
      title: "Obrigado / encerramento",
      body: "Obrigado pelo contato. Se precisar de mais alguma coisa, é só chamar.",
    },
  ],
  automations: [
    {
      key: "lead-2h",
      name: "Lead sem resposta — 2 horas",
      description: "Marca o contato novo que ainda não teve retorno.",
      trigger_event: "message.received",
      followup_minutes: 120,
      actions: [{ type: "add_tag", config: { tags: ["follow-up-2h"] } }],
    },
    {
      key: "lead-24h",
      name: "Lead sem resposta — 24 horas",
      description: "Marca quem ficou um dia sem resposta.",
      trigger_event: "message.received",
      followup_minutes: 1440,
      actions: [{ type: "add_tag", config: { tags: ["follow-up-24h"] } }],
    },
    {
      key: "proposta-sem-resposta",
      name: "Proposta sem resposta",
      description: "Marca quem entrou em Cotação / Proposta.",
      trigger_event: "lead.stage_changed",
      stage_name: "Cotação / Proposta",
      actions: [{ type: "add_tag", config: { tags: ["proposta-aberta"] } }],
    },
    {
      key: "reativacao",
      name: "Reativação de cliente",
      trigger_event: "lead.created",
      actions: [{ type: "add_tag", config: { tags: ["reativar"] } }],
    },
    {
      key: "devolucao-proxima",
      name: "Devolução próxima",
      requires_gestao: true,
    },
    {
      key: "boleto-a-vencer",
      name: "Boleto a vencer",
      requires_gestao: true,
    },
    {
      key: "pagamento-atrasado",
      name: "Pagamento atrasado",
      requires_gestao: true,
    },
  ],
  followups: fluxosProntosDoPack({
    quem: "da locadora",
    proposta: "Cotação / Proposta",
    agendamento: "Reserva / Documentação",
    ganho: "Fechado — Locação",
  }),
  campaigns: [
    {
      key: "volte-a-alugar",
      title: "Volte a alugar com a gente",
      body: "Oi! Faz um tempo que não nos falamos. Quando quiser uma nova locação, é só responder esta mensagem.",
    },
    {
      key: "nova-locacao",
      title: "Temos condições para uma nova locação",
      body: "Separámos algumas opções para uma nova locação. Quer que eu te mostre o que cabe no seu período?",
    },
    {
      key: "orcamento-aberto",
      title: "Seu orçamento ainda está em aberto",
      body: "Seu orçamento ainda está em aberto. Posso te ajudar a fechar ou ajustar alguma coisa?",
    },
    {
      key: "satisfacao",
      title: "Como foi sua experiência?",
      body: "Como foi sua experiência com a gente? Sua resposta nos ajuda a melhorar.",
    },
    {
      key: "renovacao",
      title: "Renovação / prorrogação",
      body: "Se quiser prorrogar a locação, me diga até quando e eu encaminho para o time.",
    },
    {
      key: "clientes-antigos",
      title: "Oferta para clientes antigos",
      body: "Que bom ter você de volta. Me conta o período e a categoria que você precisa.",
    },
    {
      key: "novidades-frota",
      title: "Novidades da frota",
      body: "Temos novidades na frota. Se quiser conhecer, me diga cidade e período.",
    },
  ],
  capabilities: [
    { key: "clientes", label: "Clientes", tool_id: "moope_consultar_cliente", read: true, write: false },
    { key: "locacoes", label: "Locações", tool_id: "moope_consultar_locacao", read: true, write: false },
    { key: "veiculos", label: "Veículos", tool_id: "moope_listar_oferta", read: true, write: false },
    { key: "disponibilidade", label: "Disponibilidade", tool_id: "moope_consultar_disponibilidade", read: true, write: false },
    { key: "financeiro", label: "Financeiro", tool_id: "moope_consultar_financeiro", read: true, write: false },
    { key: "manutencao", label: "Manutenção", tool_id: "moope_consultar_manutencao", read: true, write: false },
    { key: "multas", label: "Multas", tool_id: "moope_consultar_multas", read: true, write: false },
    { key: "sinistros", label: "Sinistros", tool_id: "moope_consultar_sinistros", read: true, write: false },
    { key: "vistorias", label: "Vistorias", tool_id: "moope_consultar_vistoria", read: true, write: false },
    { key: "documentos", label: "Documentos", tool_id: "moope_consultar_documentos", read: true, write: false },
    { key: "unidades", label: "Unidades", tool_id: "moope_listar_unidades", read: true, write: false },
  ],
  ai_mode_default: "copilot",
};
