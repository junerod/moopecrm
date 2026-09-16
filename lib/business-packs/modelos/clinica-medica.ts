import {
  automacoesPadraoDoPack,
  campanhasPadrao,
  fluxosProntosDoPack,
  respostasPadrao,
} from "@/lib/business-packs/sementes";
import type { BusinessPackDefinition } from "@/lib/business-packs/tipos";
import { DEFINITION_SERVICOS } from "@/lib/ready-models/modelos/servicos";

const VOZ =
  "Você atende em nome da clínica configurada — nunca de outra marca. " +
  "Uma conversa só: você é uma especialidade interna, o paciente fala com um único atendente. " +
  "Não invente diagnóstico, prescrição, conduta clínica, resultado de exame, medicamento nem o que o médico disse. " +
  "Pergunta clínica ou de tratamento: encaminhe para o profissional. " +
  "Knowledge só explica material administrativo da clínica (horários, convênios, preparação cadastrada) e cita a fonte. " +
  "Não prometa resultado de tratamento.";

export const PACK_CLINICA_MEDICA: BusinessPackDefinition = {
  id: "clinica_medica",
  version: "1.0",
  label: "Clínica médica",
  description: "Organize novos pacientes, agenda, documentos, retornos e o lado administrativo.",
  ready_model_id: "servicos",
  pipeline: {
    nome: "AGENDA — CLÍNICA",
    etapas: [
      { nome: "Novo contato", passo: "new" },
      { nome: "Triagem", passo: "contacted" },
      { nome: "Entendendo o caso", passo: "qualifying" },
      { nome: "Quer agendar", passo: "qualified" },
      { nome: "Escolhendo horário", passo: "negotiating" },
      { nome: "Consulta marcada", passo: "won" },
      { nome: "Retorno", passo: null },
      { nome: "Não vai marcar", passo: "lost" },
    ],
  },
  fields: DEFINITION_SERVICOS.fields,
  vocabulary: { lead: "Paciente", deal: "Consulta", won: "Consulta marcada", lost: "Não vai marcar" },
  collections: [
    { slug: "atendimento-da-clinica", name: "Atendimento da clínica" },
    { slug: "especialidades", name: "Especialidades e horários" },
    { slug: "documentos-e-preparo", name: "Documentos e preparo" },
    { slug: "convenio-e-financeiro", name: "Convênio e financeiro" },
    { slug: "relacionamento", name: "Relacionamento" },
  ],
  specialties: [
    {
      key: "recepcao",
      name: "Recepção da clínica",
      description: "Recebe, identifica se é paciente ou novo contato e encaminha.",
      is_default: true,
      collection_slugs: ["atendimento-da-clinica", "especialidades"],
      tool_ids: [],
      voice: VOZ + " Colete nome, se já é paciente e o motivo administrativo da busca. Sem diagnóstico.",
    },
    {
      key: "comercial",
      name: "Novos pacientes",
      description: "Qualifica especialidade desejada e agenda.",
      collection_slugs: ["especialidades", "convenio-e-financeiro"],
      tool_ids: [],
      voice: VOZ + " Ajude a agendar. Convênio e valor só com tabela cadastrada. Sem conduta clínica.",
    },
    {
      key: "atendimento",
      name: "Atendimento ao paciente",
      description: "Orientações administrativas, horários e encaminhamento.",
      collection_slugs: ["atendimento-da-clinica", "documentos-e-preparo"],
      tool_ids: [],
      voice: VOZ + " Só o lado administrativo. Resultado de exame e o que o médico disse: humano.",
    },
    {
      key: "documentos",
      name: "Documentos e exames",
      description: "Pede documentos do checklist cadastrado. Não interpreta exame.",
      collection_slugs: ["documentos-e-preparo"],
      tool_ids: [],
      voice: VOZ + " Liste só o checklist cadastrado. Não interprete exame nem invente preparo.",
    },
    {
      key: "financeiro",
      name: "Convênio e financeiro",
      description: "Informa valor e convênio só com fonte.",
      collection_slugs: ["convenio-e-financeiro"],
      tool_ids: [],
      voice: VOZ + " Particular, convênio e vencimento só com dado da clínica. Não invente cobertura.",
    },
    {
      key: "relacionamento",
      name: "Retorno e relacionamento",
      description: "Lembrete, satisfação e reativação.",
      collection_slugs: ["relacionamento"],
      tool_ids: [],
      voice: VOZ + " Lembrete e satisfação. Sem conselho clínico no follow-up.",
    },
  ],
  intents: [
    { name: "saudacao", description: "Abertura.", examples: ["oi", "quero marcar consulta"], keywords: ["oi", "ola", "marcar consulta"], specialty_key: "recepcao" },
    { name: "agendar_consulta", description: "Agendar.", examples: ["quero marcar uma consulta", "tem horário"], keywords: ["marcar", "agendar", "horario", "consulta"], specialty_key: "comercial" },
    { name: "preco", description: "Valor da consulta.", examples: ["quanto custa a consulta", "aceitam meu convênio"], keywords: ["quanto custa", "convenio", "convênio", "particular"], specialty_key: "financeiro" },
    { name: "documentos", description: "O que levar.", examples: ["o que preciso levar", "quais documentos"], keywords: ["o que levar", "documentos", "preparo"], specialty_key: "documentos" },
    { name: "diagnostico", description: "Pergunta clínica.", examples: ["o que eu tenho", "é grave", "qual o diagnóstico"], keywords: ["diagnostico", "diagnóstico", "o que eu tenho", "e grave", "é grave"], specialty_key: "atendimento" },
    { name: "prescricao", description: "Pedido de receita.", examples: ["pode passar um remédio", "qual medicamento"], keywords: ["remedio", "remédio", "receita", "medicamento", "prescricao"], specialty_key: "atendimento" },
    { name: "resultado_exame", description: "Resultado de exame.", examples: ["saíram meus exames", "o que o exame deu"], keywords: ["exame", "resultado", "laudo"], specialty_key: "atendimento" },
    { name: "followup", description: "Retorno.", examples: ["preciso remarcar o retorno"], keywords: ["retorno", "remarcar"], specialty_key: "relacionamento" },
  ],
  quick_replies: respostasPadrao("da clínica"),
  automations: automacoesPadraoDoPack({
    proposta: "Quer agendar",
    agendamento: "Consulta marcada",
    ganho: "Retorno",
  }),
  followups: fluxosProntosDoPack({
    quem: "da clínica",
    proposta: "Quer agendar",
    agendamento: "Consulta marcada",
    ganho: "Retorno",
  }),
  campaigns: campanhasPadrao("da clínica"),
  capabilities: [
    { key: "clientes", label: "Pacientes", tool_id: null, read: false, write: false },
    { key: "financeiro", label: "Convênio e valores", tool_id: null, read: false, write: false },
    { key: "documentos", label: "Documentos e preparo", tool_id: null, read: false, write: false },
  ],
  ai_mode_default: "copilot",
};
