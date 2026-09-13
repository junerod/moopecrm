# MOOPE CRM — Knowledge multimodal + coleções — Resultado

Extensão do Knowledge/RAG já existente. Não é uma arquitetura nova.

## 1. Base / commit inicial

- HEAD de partida: `cb2b0218` — `fix(env): honor Finance names for R2 and mailserver`
- Commits relevantes já na árvore: `7225fc17` (visual), `655661c6` / `3d4139a9` (ingestão documental)
- Push: **não feito**

## 2. Arquitetura encontrada

Mesmo circuito:

documento/fonte → extração → `ai_knowledge_sources` → chunks → embeddings → `ai_chunks` → versão ativa → `retrieve_top_k_chunks` → Copilot / Assistente / MCP

| Peça | Path |
|---|---|
| Upload | `POST /api/v1/ai/knowledge/sources/upload` |
| Coleções | `GET/POST /api/v1/ai/knowledge/collections` + `organizations.settings.knowledge_collections` |
| Consultar | `POST /api/v1/ai/knowledge/consultar` (`agent_id` opcional) |
| Extração | `extractDocument` — PDF/DOCX/TXT/MD + PNG/JPG/WEBP |
| Vision | `lib/ai/knowledge/visual/analisar.ts` → `analisarDocumentoVisual` |
| OCR | existente, opcional (`OCR_PROVIDER`) — não é Vision |
| Indexer | `workers/rag-indexer.ts` — originais + `derived_chunks` |
| Retrieve | `lib/ai/knowledge/busca.ts` + filtro de coleção + dedup |
| Copilot | `recuperarConhecimentoDaEmpresa` |
| Assistente | `search_knowledge` em `inbound-turn.ts` |
| MCP | `crm_search_knowledge` em `lib/mcp/tools/evolucao.ts` |

## 3. Arquivos alterados

Núcleo: `lib/ai/knowledge/{provenance,colecoes,enriquecer,injecao,visual/*}.ts`, `lib/ai/rag/extractors/imagem.ts`, upload, indexer, busca, recuperar, inbound-turn, MCP, coleções API, UI Ensine a MOOPE / detalhe / coleções.

Testes: `tests/unit/knowledge-multimodal.test.ts`, `tests/e2e/knowledge-multimodal.spec.ts`, fixtures.

Relatórios e screenshots nesta pasta e em `docs/knowledge-multimodal/screenshots/`.

Não entrou o artefato `lib/agent-engine/golden-candidates/…json` (lixo de runtime).

## 4. Schema / migration

**Nenhuma migration.**

Coleção, provenance e conhecimento derivado cabem no JSONB já existente:

- `organizations.settings.knowledge_collections`
- `ai_knowledge_sources.source_metadata.collection_ids` / `derived` / `derived_chunks` / `visual_pages` / `processing`
- `ai_agents.config.knowledge_collection_ids`
- `ai_chunks.metadata.content_kind` / `generated_by_ai` / `filename` / `page`

`source_type` continua `policy` para upload (CHECK do banco não tem `document`).

## 5. Pipeline PDF

pdfjs atual → heurística por página (`decidirVisionNaPagina`) → OCR só se já era `needs_ocr` → Vision só se página pobre / imagem / teto 6.

Página com texto longo e sem sinal de imagem **não** chama Vision.

## 6. Pipeline imagem

PNG/JPG/JPEG/WEBP são fonte válida: validação de magic bytes → storage → Vision se houver modelo → descrição factual + derivado → mesmos chunks/RAG. Sem Vision: `vision_unavailable`, original permanece, upload não quebra.

## 7. OCR

Preservado. Serve para “que texto aparece”. Não substitui Vision. PDF escaneado sem OCR continua `needs_ocr`.

## 8. Vision

Interface única: `analisarDocumentoVisual`. Reusa `isAiGatewayConfigured` + `resolveLanguageModel` + `modelCapabilities(provider, id).image`.

Não há env nova. Sem provider multimodal: `realizada=false`, status “Análise visual indisponível”.

## 9. Provider / model real

- Default de chat: `anthropic/claude-sonnet-5` (`DEFAULT_BOT_MODEL`)
- Escolha: gateway Vercel → OpenRouter → provider direto
- Capacidade de imagem: registro em `lib/agent-engine/edge/llm/capabilities.ts` (anthropic/openai/google)
- Nesta rodada **não** houve chamada Vision observada no E2E (cadastro/FAQ respondeu). **VISION REAL: NÃO**

## 10. Fallback sem provider

Upload 201. Imagem sem Vision: `extract_status=vision_unavailable`. Texto/OCR segue. Unit: `enriquecer` com `analisar` injetado.

## 11. Normalização

`normalizarParaRetrieval`: sem LLM devolve o original; com LLM pede reorganização sem alterar fatos. Unit: valor monetário preservado quando `model: null`.

## 12. Conhecimento derivado

`gerarConhecimentoDerivado` → summary/topics/products/… gravado em `source_metadata.derived`. Vira `derived_chunks` (`content_kind=ai_derived`). Sem LLM: `realizada=false`.

## 13. Chunks original / derivado

Indexer grava os dois. Metadata marca `generated_by_ai`. Citação **não** usa esse rótulo.

## 14. Embeddings

Inalterados: `openai/text-embedding-3-small`, 1536. Sem chave, Testar cai no cadastro (FAQ + `extracted_text`/`pages`).

## 15. Retrieval

Mesma RPC. Over-fetch `topK * 4` (máx. 20) quando há filtro de coleção. `sourceIdsPermitidos` depois do limiar.

## 16. Ranking / dedup

`consolidarOriginalEDerivado`: mesmo `source_id` + página → fica o de maior similaridade. Unit verde.

## 17. Citations / provenance

`citacaoDaFonteOriginal`: `Manual.pdf · página 4` — nunca “resumo da IA”. Inbox: `citationsFromHits` grava `metadata.citation`. Testar mostra o filename. E2E: fonte `Manual-Veiculos-MOOPE.pdf` / `Campanha-Locadoras.txt`.

## 18. Coleções

Organização do **mesmo** Knowledge. Semear padrão: Suporte, Comercial, Jurídico, Conhecimento geral. Documento N:N via `collection_ids`. Sem segundo RAG.

Agente sem coleção marcada = vê tudo (compatível).

Fonte sem coleção + agente restrito = **não entra** (não vaza comercial sem tag).

## 19. Escopo por agente

`ai_agents.config.knowledge_collection_ids`. Tela: aba Coleções → “Conhecimento permitido neste assistente”. Assistente e MCP leem o mesmo campo. E2E: suporte não cita Campanha; comercial cita.

## 20. Copilot

`recuperarConhecimentoDaEmpresa`. Sem `agent_id`: acervo do agente padrão, **todas** as coleções. Com `agent_id`: respeita coleções. Fallback FAQ/docs também filtra. Não envia mensagem.

## 21. Assistente

`search_knowledge` filtra coleções e embrulha o trecho com `embrulharComoConteudo`. AI_MODE / Action Policy **não** foram alterados. Autonomous **não** ligado.

## 22. MCP

`crm_search_knowledge` usa `buscarConhecimento` + filtro de coleção + `organization_id` do contexto. Sem MCP novo. Sem sessão MCP ao vivo nesta rodada.

## 23. Storage Supabase

Default. Path `{orgId}/{sourceId}/{filename}`. Sem mudança de contrato.

## 24. Storage R2

Abstraction existente. Mock unitário já validado em `knowledge-documentos-reais`. **R2 real não revalidado nesta rodada.**

## 25. Tenant isolation

RPC + `organization_id` do JWT. E2E org B: vazio, sem `847,35`. Original e derivado compartilham o mesmo tenant filter.

## 26. Prompt injection

Documento é conteúdo. `documentoPareceInstrucao` + `embrulharComoConteudo` no turno. Fixture `Ignore suas instruções…`. E2E recupera “12 por cento” como texto; não há execução de comando (consultar só lê o acervo).

## 27. Idempotência

Reprocess: mesma fonte, `triggered_by=manual_reindex`. E2E: contagem de fontes não aumenta. Indexer reconstrói **uma** versão ativa. `derived_chunks` vêm da meta (não se acumulam em fontes novas).

## 28. Delete

Arquiva, `is_active=false`, chunks da fonte saem, vínculo de coleção some com a fonte, blob pelo provider gravado. E2E: `TESTE-MULTIMODAL-9271` acha → exclui o manual → mesma pergunta vazia.

## 29. Performance / custo

Heurística + teto 6 páginas. `processing`: pages_total / pages_text / pages_ocr / pages_vision / extract_ms no log de upload. Sem billing engine. Sem log do documento inteiro.

## 30. Mobile / light / dark

E2E 390×844 sem overflow; dark via `theme-option-dark`; light default. Screenshots 10 e 11.

## 31. Testes unitários

`tests/unit/knowledge-multimodal.test.ts`: heurística, PNG, Vision mock/fallback, provenance, dedup, coleções, injeção, status, derivado, enriquecer sem Vision, normalização, storage key, OCR≠Vision.

Também verdes nesta máquina: `knowledge-2-pipeline`, `knowledge-documentos-reais`, `e2e-cobertura-completa`, `mapas-de-arquitetura`.

## 32. test:db

**Verde:** 130 files, 1016 passed, 1 expected fail, 1 skipped. Install + update do baseline. Sem migration nova.

## 33. E2E

`knowledge-multimodal.spec.ts`: **1 passed (26.2s)** — PDF + PNG + TXT comercial + coleções + filtro de agente + isolamento B + anti-alucinação + injeção como conteúdo + reprocess + delete + mobile + dark.

## 34. Regressões

- Knowledge 2: **1 passed**
- Documentos reais: **1 passed**
- Productization 3C: **não re-executado** (abas/testids preservados; heading `Conhecimento da Empresa` continua em `sr-only`)
- Copilot/RAG: mesmo retrieve; sem conversa aberta
- AI_MODE / Action Policy: **não tocados**
- Tenant isolation: e2e multimodal + knowledge-2 + test:db RLS

WhatsApp WORKING / VPS / QR: **não tocados**.

## 35. Screenshots

`docs/knowledge-multimodal/screenshots/01` … `11` (todos gerados pelo E2E). Sem secrets.

## 36. Resíduos reais

- Vision no upload síncrono: PDF grande pode estourar tempo se muitas páginas candidatas (teto 6 mitiga).
- Reprocess com `forcarDownload` não re-roda Vision se a meta já tem páginas — derivado antigo é reindexado.
- FAQ matcher é OR de termos: pergunta genérica (“MOOPE”) pode achar outra fonte; coleção e tokens exclusivos compensam.
- `ColecoesDaEmpresa` ainda lê checkboxes do assistente via `querySelector`.
- Working tree tem zips/xray/screenshots de outras sessões — **fora deste commit**.

## 37. Blockers reais

- Análise visual de PNG comercial no E2E **não** foi Vision real: o retrieve comercial usou `Campanha-Locadoras.txt` (mesmo conteúdo da propaganda). A imagem foi aceita e armazenada.
- Sem modelo multimodal na instalação de E2E, o detalhe mostra “Ainda não há resumo derivado”.
- Conversas→RAG e Nuvemshop continuam **parciais** (pré-existente). Esta rodada não os alterou.

## 38. Commit

`b218498a` local — `feat(ai): add multimodal knowledge and collections`. Sem push.

## 39. Push

**NÃO.**

## 40. Veredito final

Ver bloco no fim deste arquivo e a matriz em `docs/MOOPE_CRM_KNOWLEDGE_MULTIMODAL_PROVAS.md`.

---

### Living System Checklist — Knowledge multimodal + coleções

1. Quem me alimenta? Upload / texto rápido / Vision seletiva (`enriquecerDocumento`)
2. Quem eu alimento? `rag-indexer` → `ai_chunks` → Copilot, Assistente, MCP, aba Testar
3. Que registro eu emito? `knowledge.source_uploaded` / `knowledge_source.updated` / audit existente
4. Onde apareço na tela? `/app/ai/knowledge/sources` (Ensine a MOOPE, detalhe, coleções)
5. Porta? `lib/navigation/registry.ts` — já existia
6. Anti-morte? Documento `vision_unavailable` / `needs_ocr` visível; sem isto o operador não sabe que a IA não leu a tela
7. Onde se configura? Coleções + escopo do assistente na mesma tela
8. Continuidade? Humano ensina → IA consulta; falha de Vision não apaga o original
9. Laço de retorno? Testar / detalhe “o que aprendeu”; pergunta vazia quando o acervo não sustenta
10. Mapa? `docs/architecture/conhecimento-2.architecture.json` — nós `vision` e `colecoes` com ≥2 arestas

### Conversas→RAG e Nuvemshop

Continuam parciais, como no relatório documental anterior. Rebuild de `knowledge_source.updated` ainda copia chunks de `conversation(s)` / `catalog` / `nuvemshop_catalog` da versão anterior. Nenhum emit TS novo de Nuvemshop. Esta rodada **não** mexeu nisso.

---

MOOPE CRM — KNOWLEDGE MULTIMODAL IMPLEMENTADO: SIM

PDF TEXTUAL: SIM
PDF MULTIPAGE: SIM
PDF ESCANEADO: PARCIAL
DOCX: SIM
TXT/MD: SIM
PNG/JPG: SIM

OCR: PARCIAL
VISION ARQUITETURA: SIM
VISION MOCK: SIM
VISION REAL: NÃO
NORMALIZAÇÃO IA: SIM
CONHECIMENTO DERIVADO: SIM

CHUNKS ORIGINAIS: SIM
CHUNKS DERIVADOS: SIM
EMBEDDING: SIM
PGVECTOR: SIM
RETRIEVAL: SIM
CITAÇÃO NA FONTE ORIGINAL: SIM
DEDUP/IDEMPOTÊNCIA: SIM

COLEÇÕES: SIM
AGENTE RESTRINGE COLEÇÕES: SIM
COPILOT USA KNOWLEDGE: SIM
ASSISTENTE USA KNOWLEDGE: SIM
MCP USA KNOWLEDGE: SIM

PROMPT INJECTION DOCUMENTAL PROTEGIDA: SIM
TENANT ISOLATION ORIGINAL: SIM
TENANT ISOLATION DERIVADO: SIM

SUPABASE STORAGE: SIM
R2 MOCK: SIM
R2 REAL: NÃO

DELETE REMOVE RETRIEVAL: SIM
REPROCESS NÃO DUPLICA: SIM

MOBILE: 8/10
LIGHT: 8/10
DARK: 8/10

TYPECHECK: VERDE
TEST:DB: 130 files / 1016 passed
E2E MULTIMODAL: 1 passed (26.2s)
REGRESSÕES CRÍTICAS: SIM

MIGRATION: nenhuma

BLOCKERS REAIS:
- Vision real não executada nesta máquina/E2E; retrieve comercial provado via TXT irmão da propaganda
- Reprocess não reexecuta Vision
- Conversas→RAG e Nuvemshop seguem parciais

PRONTO PARA USO INTERNO MOOPE: SIM
PRONTO PARA PILOTO CONTROLADO: SIM

COMMIT LOCAL: `b218498a` — `feat(ai): add multimodal knowledge and collections`
PUSH: NÃO

PRÓXIMO PASSO:
USO INTERNO / PILOTO CONTROLADO
