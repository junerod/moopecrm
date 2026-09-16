import {
  automacoesPadraoDoPack,
  campanhasPadrao,
  fluxosProntosDoPack,
  respostasPadrao,
} from "@/lib/business-packs/sementes";
import type { BusinessPackDefinition } from "@/lib/business-packs/tipos";
import { DEFINITION_COMERCIAL } from "@/lib/ready-models/modelos/comercial";

const VOZ =
  "Você atende em nome da empresa configurada — nunca de outra marca. " +
  "Uma conversa só: você é uma especialidade interna, o cliente fala com um único atendente. " +
  "Não invente preço, SLA, prazo de implantação, desconto nem capacidade do produto. " +
  "Knowledge só explica material que a empresa cadastrou e cita a fonte. " +
  "Sem fonte, pergunte ou encaminhe para uma pessoa. Não prometa resultado.";

export const PACK_VENDAS_SAAS: BusinessPackDefinition = {
  id: "vendas_saas",
  version: "1.0",
  label: "Vendas de SaaS",
  description: "Qualifique empresas, agende demo, acompanhe piloto e feche o cliente.",
  ready_model_id: "comercial",
  pipeline: {
    nome: "VENDAS — SaaS",
    etapas: [
      { nome: "Novo contato", passo: "new" },
      { nome: "Triagem", passo: "contacted" },
      { nome: "Qualificado", passo: "qualifying" },
      { nome: "Demo / piloto", passo: "qualified" },
      { nome: "Proposta", passo: null },
      { nome: "Em negociação", passo: "negotiating" },
      { nome: "Cliente ativo", passo: "won" },
      { nome: "Não fechou", passo: "lost" },
    ],
  },
  fields: DEFINITION_COMERCIAL.fields,
  vocabulary: { lead: "Lead", deal: "Oportunidade", won: "Cliente ativo", lost: "Não fechou" },
  collections: [
    { slug: "produto-e-posicionamento", name: "Produto e posicionamento" },
    { slug: "comercial-saas", name: "Comercial e preços" },
    { slug: "onboarding-do-cliente", name: "Onboarding do cliente" },
    { slug: "suporte", name: "Suporte" },
    { slug: "relacionamento", name: "Relacionamento" },
  ],
  specialties: [
    {
      key: "recepcao",
      name: "Recepção comercial",
      description: "Recebe, entende o tipo de empresa e encaminha.",
      is_default: true,
      collection_slugs: ["produto-e-posicionamento"],
      tool_ids: [],
      voice: VOZ + " Você é a recepção. Colete nome, empresa e o que buscam. Não venda feature inventada.",
    },
    {
      key: "comercial",
      name: "Vendas e demo",
      description: "Qualifica, agenda demo e acompanha piloto.",
      collection_slugs: ["comercial-saas", "produto-e-posicionamento"],
      tool_ids: [],
      voice: VOZ + " Qualifique operação, tamanho e urgência. Sugira demo. Preço só com tabela cadastrada.",
    },
    {
      key: "atendimento",
      name: "Onboarding do cliente",
      description: "Ajuda o cliente novo a começar, sem inventar o produto.",
      collection_slugs: ["onboarding-do-cliente", "produto-e-posicionamento"],
      tool_ids: [],
      voice: VOZ + " Oriente só o que estiver no material de onboarding. Sem fonte, encaminhe ao time.",
    },
    {
      key: "documentos",
      name: "Proposta e contrato",
      description: "Pede dados e confirma envio da proposta quando o sistema souber.",
      collection_slugs: ["comercial-saas"],
      tool_ids: [],
      voice: VOZ + " Não invente cláusula nem valor. Encaminhe proposta só se houver modelo cadastrado.",
    },
    {
      key: "financeiro",
      name: "Financeiro",
      description: "Fala de plano e vencimento só com fonte.",
      collection_slugs: ["comercial-saas"],
      tool_ids: [],
      voice: VOZ + " Plano, vencimento e segunda via só com dado confiável. Senão: não consegui consultar agora.",
    },
    {
      key: "relacionamento",
      name: "Sucesso e relacionamento",
      description: "Follow-up, renovação e satisfação.",
      collection_slugs: ["relacionamento", "suporte"],
      tool_ids: [],
      voice: VOZ + " Follow-up e satisfação. Não dispare campanha sem configuração.",
    },
  ],
  intents: [
    { name: "saudacao", description: "Abertura.", examples: ["oi", "quero conhecer o sistema"], keywords: ["oi", "ola", "conhecer"], specialty_key: "recepcao" },
    { name: "demo", description: "Pedir demonstração.", examples: ["quero uma demo", "podem apresentar o sistema"], keywords: ["demo", "demonstracao", "apresentar o sistema", "piloto"], specialty_key: "comercial" },
    { name: "preco", description: "Preço ou plano.", examples: ["quanto custa", "qual o valor do plano"], keywords: ["quanto custa", "preco", "preço", "plano", "mensalidade"], specialty_key: "financeiro" },
    { name: "sla", description: "SLA ou prazo de implantação.", examples: ["qual o SLA", "em quanto tempo implantam"], keywords: ["sla", "prazo de implantacao", "implantação"], specialty_key: "atendimento" },
    { name: "proposta", description: "Proposta comercial.", examples: ["podem enviar a proposta"], keywords: ["proposta", "contrato"], specialty_key: "documentos" },
    { name: "suporte", description: "Cliente pedindo ajuda.", examples: ["não estou conseguindo usar"], keywords: ["nao estou conseguindo", "suporte", "ajuda com o sistema"], specialty_key: "atendimento" },
    { name: "followup", description: "Retorno.", examples: ["estou passando para saber se avaliaram"], keywords: ["avaliar", "faz tempo"], specialty_key: "relacionamento" },
  ],
  quick_replies: respostasPadrao("do time comercial"),
  automations: automacoesPadraoDoPack({
    proposta: "Proposta",
    agendamento: "Demo / piloto",
    ganho: "Cliente ativo",
  }),
  followups: fluxosProntosDoPack({
    quem: "do time comercial",
    proposta: "Proposta",
    agendamento: "Demo / piloto",
    ganho: "Cliente ativo",
  }),
  campaigns: campanhasPadrao("da empresa"),
  capabilities: [
    { key: "clientes", label: "Empresas", tool_id: null, read: false, write: false },
    { key: "financeiro", label: "Planos e vencimentos", tool_id: null, read: false, write: false },
    { key: "documentos", label: "Proposta", tool_id: null, read: false, write: false },
  ],
  ai_mode_default: "copilot",
};
