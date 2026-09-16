import {
  automacoesPadraoDoPack,
  campanhasPadrao,
  fluxosProntosDoPack,
  respostasPadrao,
} from "@/lib/business-packs/sementes";
import type { BusinessPackDefinition } from "@/lib/business-packs/tipos";
import { DEFINITION_SERVICOS } from "@/lib/ready-models/modelos/servicos";

const VOZ =
  "Você atende em nome da clínica odontológica configurada — nunca de outra marca. " +
  "Uma conversa só: você é uma especialidade interna, o paciente fala com um único atendente. " +
  "Não invente diagnóstico, plano de tratamento, conduta clínica, resultado de exame nem valor de procedimento sem tabela cadastrada. " +
  "Pergunta clínica: encaminhe para o dentista. Knowledge só explica material administrativo da clínica. " +
  "Não prometa resultado estético ou clínico.";

export const PACK_CLINICA_ODONTOLOGICA: BusinessPackDefinition = {
  id: "clinica_odontologica",
  version: "1.0",
  label: "Clínica odontológica",
  description: "Organize avaliação, orçamento, agenda, documentos e o relacionamento com o paciente.",
  ready_model_id: "servicos",
  pipeline: {
    nome: "AGENDA — ODONTO",
    etapas: [
      { nome: "Novo contato", passo: "new" },
      { nome: "Triagem", passo: "contacted" },
      { nome: "Avaliação", passo: "qualifying" },
      { nome: "Orçamento enviado", passo: "qualified" },
      { nome: "Aguardando agendamento", passo: "negotiating" },
      { nome: "Tratamento iniciado", passo: "won" },
      { nome: "Alta", passo: null },
      { nome: "Não fechou", passo: "lost" },
    ],
  },
  fields: DEFINITION_SERVICOS.fields,
  vocabulary: { lead: "Paciente", deal: "Tratamento", won: "Tratamento iniciado", lost: "Não fechou" },
  collections: [
    { slug: "atendimento-odonto", name: "Atendimento da clínica" },
    { slug: "procedimentos", name: "Procedimentos e horários" },
    { slug: "documentos-odonto", name: "Documentos e preparo" },
    { slug: "orcamento-odonto", name: "Orçamento e convênio" },
    { slug: "relacionamento", name: "Relacionamento" },
  ],
  specialties: [
    {
      key: "recepcao",
      name: "Recepção da clínica",
      description: "Recebe, identifica paciente ou novo contato e encaminha.",
      is_default: true,
      collection_slugs: ["atendimento-odonto", "procedimentos"],
      tool_ids: [],
      voice: VOZ + " Colete nome e o motivo administrativo (dor, avaliação, orçamento). Sem diagnóstico.",
    },
    {
      key: "comercial",
      name: "Avaliação e orçamento",
      description: "Agenda avaliação e acompanha orçamento cadastrado.",
      collection_slugs: ["orcamento-odonto", "procedimentos"],
      tool_ids: [],
      voice: VOZ + " Sugira avaliação. Valor de procedimento só com tabela cadastrada. Sem plano inventado.",
    },
    {
      key: "atendimento",
      name: "Atendimento ao paciente",
      description: "Orientações administrativas durante o tratamento.",
      collection_slugs: ["atendimento-odonto", "documentos-odonto"],
      tool_ids: [],
      voice: VOZ + " Lado administrativo. Conduta e o que o dentista disse: humano.",
    },
    {
      key: "documentos",
      name: "Documentos e exames",
      description: "Checklist documental cadastrado. Não interpreta raio-X.",
      collection_slugs: ["documentos-odonto"],
      tool_ids: [],
      voice: VOZ + " Só o checklist da clínica. Não interprete exame de imagem.",
    },
    {
      key: "financeiro",
      name: "Orçamento e financeiro",
      description: "Parcelas e convênio só com fonte.",
      collection_slugs: ["orcamento-odonto"],
      tool_ids: [],
      voice: VOZ + " Valor e parcela só com orçamento oficial. Não invente tratamento nem preço.",
    },
    {
      key: "relacionamento",
      name: "Retorno e relacionamento",
      description: "Lembrete, manutenção e satisfação.",
      collection_slugs: ["relacionamento"],
      tool_ids: [],
      voice: VOZ + " Lembrete de retorno e satisfação. Sem conselho clínico.",
    },
  ],
  intents: [
    { name: "saudacao", description: "Abertura.", examples: ["oi", "quero marcar avaliação"], keywords: ["oi", "ola", "avaliacao", "avaliação"], specialty_key: "recepcao" },
    { name: "agendar_consulta", description: "Agendar.", examples: ["quero marcar uma avaliação", "tem horário"], keywords: ["marcar", "agendar", "horario", "avaliacao"], specialty_key: "comercial" },
    { name: "preco", description: "Valor.", examples: ["quanto custa um implante", "qual o valor da limpeza"], keywords: ["quanto custa", "implante", "limpeza", "orcamento", "orçamento"], specialty_key: "financeiro" },
    { name: "documentos", description: "O que levar.", examples: ["preciso levar exame", "quais documentos"], keywords: ["levar exame", "documentos", "raio"], specialty_key: "documentos" },
    { name: "diagnostico", description: "Pergunta clínica.", examples: ["preciso extrair o dente", "está inflamado"], keywords: ["extrair", "inflamado", "canal", "diagnostico"], specialty_key: "atendimento" },
    { name: "tratamento", description: "Plano de tratamento.", examples: ["qual o tratamento", "quantas sessões"], keywords: ["tratamento", "sessoes", "sessões", "plano"], specialty_key: "atendimento" },
    { name: "resultado_exame", description: "Exame de imagem.", examples: ["o que o raio-x mostrou"], keywords: ["raio-x", "raio x", "exame mostrou"], specialty_key: "atendimento" },
    { name: "followup", description: "Retorno.", examples: ["quero remarcar a manutenção"], keywords: ["manutencao", "manutenção", "retorno"], specialty_key: "relacionamento" },
  ],
  quick_replies: respostasPadrao("da clínica odontológica"),
  automations: automacoesPadraoDoPack({
    proposta: "Orçamento enviado",
    agendamento: "Tratamento iniciado",
    ganho: "Alta",
  }),
  followups: fluxosProntosDoPack({
    quem: "da clínica odontológica",
    proposta: "Orçamento enviado",
    agendamento: "Tratamento iniciado",
    ganho: "Alta",
  }),
  campaigns: campanhasPadrao("da clínica"),
  capabilities: [
    { key: "clientes", label: "Pacientes", tool_id: null, read: false, write: false },
    { key: "financeiro", label: "Orçamento e parcelas", tool_id: null, read: false, write: false },
    { key: "documentos", label: "Documentos e exames", tool_id: null, read: false, write: false },
  ],
  ai_mode_default: "copilot",
};
