import { automacoesPadraoDoPack, campanhasPadrao, respostasPadrao } from "@/lib/business-packs/sementes";
import type { BusinessPackDefinition } from "@/lib/business-packs/tipos";
import { DEFINITION_COMERCIAL } from "@/lib/ready-models/modelos/comercial";

const VOZ =
  "Você atende em nome da empresa configurada — nunca de outra marca. " +
  "Uma conversa só: você é uma especialidade interna, o cliente fala com um único atendente. " +
  "Não invente preço, estoque, prazo de entrega nem condição comercial. " +
  "Knowledge só explica material cadastrado pela empresa. Sem fonte, pergunte ou encaminhe.";

export const PACK_COMERCIAL_GERAL: BusinessPackDefinition = {
  id: "comercial_geral",
  version: "1.0",
  label: "Comercial geral",
  description: "Atenda, qualifique, envie proposta e acompanhe a venda — para quem vende produto ou serviço.",
  ready_model_id: "comercial",
  pipeline: {
    nome: "VENDAS — COMERCIAL",
    etapas: [
      { nome: "Novo lead", passo: "new" },
      { nome: "Em atendimento", passo: "contacted" },
      { nome: "Qualificado", passo: "qualifying" },
      { nome: "Proposta enviada", passo: "qualified" },
      { nome: "Em negociação", passo: "negotiating" },
      { nome: "Aguardando fechamento", passo: null },
      { nome: "Fechado", passo: "won" },
      { nome: "Não fechou", passo: "lost" },
    ],
  },
  fields: DEFINITION_COMERCIAL.fields,
  vocabulary: { lead: "Lead", deal: "Negócio", won: "Fechado", lost: "Não fechou" },
  collections: [
    { slug: "atendimento-comercial", name: "Atendimento comercial" },
    { slug: "produtos-e-servicos", name: "Produtos e serviços" },
    { slug: "precos-e-condicoes", name: "Preços e condições" },
    { slug: "pos-venda", name: "Pós-venda" },
    { slug: "relacionamento", name: "Relacionamento" },
  ],
  specialties: [
    {
      key: "recepcao",
      name: "Recepção",
      description: "Recebe e entende se é venda nova ou cliente.",
      is_default: true,
      collection_slugs: ["atendimento-comercial"],
      tool_ids: [],
      voice: VOZ + " Receba, pergunte o que a pessoa busca e encaminhe.",
    },
    {
      key: "comercial",
      name: "Vendas",
      description: "Qualifica, monta proposta e faz follow-up.",
      collection_slugs: ["produtos-e-servicos", "precos-e-condicoes"],
      tool_ids: [],
      voice: VOZ + " Qualifique necessidade e urgência. Preço só com tabela cadastrada.",
    },
    {
      key: "atendimento",
      name: "Atendimento ao cliente",
      description: "Pós-venda e dúvidas administrativas.",
      collection_slugs: ["pos-venda", "atendimento-comercial"],
      tool_ids: [],
      voice: VOZ + " Oriente o lado administrativo. Pedido e prazo só com fonte.",
    },
    {
      key: "documentos",
      name: "Pedido e documentos",
      description: "Pede dados do pedido e confirma recebimento quando souber.",
      collection_slugs: ["produtos-e-servicos"],
      tool_ids: [],
      voice: VOZ + " Não invente item de pedido. Confirme só o que o sistema registrar.",
    },
    {
      key: "financeiro",
      name: "Financeiro",
      description: "Cobrança e vencimento só com fonte.",
      collection_slugs: ["precos-e-condicoes"],
      tool_ids: [],
      voice: VOZ + " Valor e vencimento só com dado confiável.",
    },
    {
      key: "relacionamento",
      name: "Relacionamento",
      description: "Follow-up, reativação e satisfação.",
      collection_slugs: ["relacionamento"],
      tool_ids: [],
      voice: VOZ + " Follow-up e reativação. Sem campanha automática inventada.",
    },
  ],
  intents: [
    { name: "saudacao", description: "Abertura.", examples: ["oi", "quero comprar"], keywords: ["oi", "ola", "quero comprar"], specialty_key: "recepcao" },
    { name: "orcamento", description: "Pedido de orçamento.", examples: ["quero um orçamento", "podem cotar"], keywords: ["orcamento", "orçamento", "cotar", "proposta"], specialty_key: "comercial" },
    { name: "preco", description: "Preço.", examples: ["quanto custa", "qual o valor"], keywords: ["quanto custa", "preco", "preço", "valor"], specialty_key: "financeiro" },
    { name: "estoque", description: "Tem o produto.", examples: ["vocês têm esse item", "tem em estoque"], keywords: ["estoque", "tem esse", "disponivel"], specialty_key: "documentos" },
    { name: "prazo_entrega", description: "Prazo de entrega.", examples: ["qual o prazo de entrega"], keywords: ["prazo de entrega", "quando chega"], specialty_key: "atendimento" },
    { name: "followup", description: "Retorno.", examples: ["conseguiu ver a proposta"], keywords: ["proposta", "faz tempo"], specialty_key: "relacionamento" },
  ],
  quick_replies: respostasPadrao("comercial"),
  automations: automacoesPadraoDoPack(),
  campaigns: campanhasPadrao("da loja"),
  capabilities: [
    { key: "clientes", label: "Clientes", tool_id: null, read: false, write: false },
    { key: "financeiro", label: "Preços e cobrança", tool_id: null, read: false, write: false },
    { key: "documentos", label: "Pedidos", tool_id: null, read: false, write: false },
  ],
  ai_mode_default: "copilot",
};
