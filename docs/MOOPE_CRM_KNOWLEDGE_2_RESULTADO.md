# MOOPE CRM — Knowledge 2.0 — Resultado

## 1. Base / git

- HEAD de partida: `7225fc17` — `feat(crm): certify premium visual experience`
- Frente visual comercial: encerrada. Esta rodada só fecha o circuito documental no RAG já existente.
- Push: **não feito**.

## 2. Arquitetura encontrada

Caminhos reais (não reconstruídos):

| Peça | Path |
|---|---|
| Upload | `POST /api/v1/ai/knowledge/sources/upload` |
| Texto rápido | `POST /api/v1/ai/knowledge/sources` |
| Consultar / Testar | `POST /api/v1/ai/knowledge/consultar` |
| Storage | bucket privado `ai-policy`, path `{orgId}/{uuid}.{ext}` |
| Extração | `lib/ai/rag/extractors/pdf.ts` (`pdfjs-dist` legacy) |
| Chunker | `lib/ai/rag/ingest/policy.ts` + `lib/ai/rag/chunker.ts` |
| Indexer | `workers/rag-indexer.ts` → `handleKnowledgeSourceUpdated` |
| Embed | `lib/ai/embed.ts` + `lib/ai/gateway.ts` — `openai/text-embedding-3-small` |
| Retrieve | RPC `retrieve_top_k_chunks` via `lib/ai/knowledge/busca.ts` |
| Consumidores | Copilot (`lib/ai/copiloto/recuperar.ts`), agente (`searchKnowledge`), MCP (`crm_search_knowledge`) |
| Tabelas | `ai_knowledge_sources`, `ai_faq_items`, `ai_chunks`, `ai_knowledge_versions` |

## 3. RAG reutilizado

Nenhum segundo vector DB, nenhum segundo MCP, nenhum segundo policy engine. A versão ativa do agente continua sendo o único acervo de `retrieve_top_k_chunks`.

## 4. Upload existente

Já gravava o blob e emitia `knowledge_source.updated`. A extração rodava só como validação e **descartava os pedaços**. O indexer lia só `ai_faq_items` — PDF sem FAQ = `skip("no_content_to_index")`. A UI ainda dizia “upload em breve”.

## 5. Mudanças

1. Extração devolve texto + páginas + chunks; o upload persiste `extracted_text` / `pages` no `source_metadata` e um `ai_faq_item` de confiança (Testar sem embedder).
2. Indexer consome `source_type=policy` (cache de páginas ou download do blob).
3. Delete arquiva, `is_active=false`, apaga chunks da versão ativa, remove o blob se o path começa com `{orgId}/`, emite rebuild.
4. Unique index relaxado só para `policy` (N PDFs).
5. UI em quatro abas, default Documentos.
6. `POST /api/v1/ai/knowledge/organizar` — preview, nunca grava.
7. `pdfjs-dist` e `@napi-rs/canvas` saem do bundle (`serverExternalPackages`) — sem isto o `next start` extraía 422 em PDF textual.

## 6. Parser PDF

Reuso de `pdfjs-dist` (já na stack). Sem OCR. PDF só-imagem continua `PdfExtractError` / “Não foi possível encontrar texto neste documento.”

## 7. Storage

Bucket `ai-policy`, path `{orgId}/{uuid}.{ext}`. Nome do usuário só em metadata. GET/SSR nunca devolvem `blob_path` nem `extracted_text`.

## 8. Pipeline

Documento → MIME/ext/tamanho → extração em memória → Storage → `ai_knowledge_sources` + FAQ de confiança → `event_log` → rag-indexer → embed → `ai_chunks` → versão ativa → retrieve.

## 9. Chunks

`chunkPolicyText` (~1600/200). PDF: um conjunto de pedaços **por página**, com `metadata.page` quando a extração devolveu página.

## 10. Embeddings

Inalterados: `text-embedding-3-small`, 1536 dims, chave da instalação (`AI_GATEWAY_API_KEY` ou `OPENAI_API_KEY`). Sem campo de chave na tela.

## 11. Retrieval

`buscarConhecimento` agora propaga `metadata`. Sem vetor, cai no cadastro (FAQ + `extracted_text`/`pages` da mesma org).

## 12. Citations

Trecho leva `fonte` (filename/nome) e `pagina` só se existir de verdade. A tela Testar mostra “Fontes utilizadas”. Não inventa página.

## 13. UI Documentos

Dropzone premium, PDF/MD/TXT, lista com ícone/nome/tamanho/data/status, “X trechos disponíveis para a IA”, ações Testar / Reprocessar / Excluir. Sem embedding/vector/chunk_id/storage path.

## 14. Texto rápido

Preservado (`adicionar-conhecimento`, Salvar conhecimento). Assunto + Conteúdo + as 10 sugestões pedidas.

## 15. Organizar com IA

Botão, preview Original vs Versão organizada, Usar / Manter. Nunca salva sozinho. No e2e local a instalação não tem LLM de chat → 503 honesto (“não está disponível nesta instalação”).

## 16. Fontes

Aba lista só linhas reais: Documento, Texto manual, FAQ, Conversa, Nuvemshop — se existirem. Sem conector inventado.

## 17. Testar

Placeholder “Faça uma pergunta sobre sua empresa”. Resposta + Fontes utilizadas. Pergunta inexistente (taxa Blumenau) → vazio, sem inventar.

## 18. Exclusão

Arquiva + `is_active=false` + delete de `ai_chunks` da fonte + blob se path do tenant + evento `source_archived` (sem debounce). E2E: pergunta acha → exclui → mesma pergunta não acha.

## 19. Reprocessamento

`POST .../reindex` com `triggered_by=manual_reindex` (bypass do debounce). Nova versão só ativa depois dos chunks. Sem duas versões ativas.

## 20. Isolamento tenant

RPC já filtra `organization_id`. Cadastro e documentos também. E2E: org B pergunta o dado exclusivo de A → vazio; body sem `AZUL-9271` / `347,80`. Unit: `buscarDocumentosDaOrg` / `buscarFaqDaOrg`.

## 21. Segurança

Tenant do JWT, MIME+ext, 20 MB, filename sanitizado, path não arbitrário, blob só `{orgId}/…`, metadata público sem path/texto. Tentativa cross-tenant no e2e.

## 22. Copilot

Continua em `recuperarConhecimentoDaEmpresa` (mesmo acervo). Unit anti-alucinação verde. **Não** abrimos conversa real nem enviamos mensagem.

## 23. Assistente

`searchKnowledge` já lia `buscarConhecimento`. Documento indexado entra na versão ativa. **Não** ativamos autonomous nem WhatsApp.

## 24. MCP

`crm_search_knowledge` chama o mesmo `buscarConhecimento`. Sem segundo MCP. Não houve sessão MCP ao vivo nesta rodada.

## 25. Conversas → RAG

**Parcial (já era).** Cron `kb-conversations-batch` + `lib/ai/rag/ingest/conversations.ts` escreve **versão própria** e ao ativar pode derrubar FAQ/política. O rebuild de `knowledge_source.updated` agora **copia** chunks de `conversation(s)` / `catalog` / `nuvemshop_catalog` da versão anterior. Não construímos engine novo. Aba Fontes mostra a linha se ela existir.

## 26. Nuvemshop

**Parcial (já era).** `handleProductSynced` existe; o emit `nuvemshop.product_synced` no TS não está vivo; insert com `knowledge_source_id: null` viola NOT NULL. Só documentado. Fontes mostra catálogo se a linha existir.

## 27. Performance

Upload valida em memória (sem re-download). Indexer usa `pages`/`extracted_text` no reindex normal; `manual_reindex` baixa de novo. Debounce 30s permanece para burst de FAQ; arquivo/reprocesso não são pulados. Embed continua sequencial no worker (já era).

## 28. Observabilidade

`logger` com `source_id`, `org_id`, tipo, status, `extract_ms`, chunks, `embed_ms`, erro sanitizado. Sem API key, sem documento completo, sem token. Audit: `knowledge.source_uploaded` / `source_archived` / `source_reindexed`.

## 29. Mobile

390×844 no e2e: dropzone, abas, lista, sem scroll horizontal.

## 30. Dark

Tema dark via controle existente. Tokens do DS certificado.

## 31. Testes

Unit: extração, normalização, chunk, status, metadata público, Organizar (prompt), isolamento FAQ+documento, GET sem `blob_path`, mapas, e2e-cobertura, 3C harness, PDF extractor (contrato antigo intacto).

## 32. test:db

Verde: **130 files, 1016 passed**, 1 expected fail, 1 skipped. Install + update do baseline com apêndice 0207.

## 33. E2E

- `knowledge-2.spec.ts`: **1 passed** (upload → 347,80 + AZUL-9271 + citação → Blumenau vazio → reprocess → delete → vazio → texto rápido → organizar 503 → mobile → dark → isolamento B).
- `productization-3c.spec.ts`: **6 passed** (abas Texto/Testar).

## 34. Migrations

`20260913120000_0207_varios_documentos_de_politica.sql`

**Por que o schema antigo não bastava:** `ai_knowledge_sources_unique_per_agent` em `(agent_id, source_type) WHERE is_active` impede o segundo PDF. Status/metadata/chunks já cabiam. Só o unique precisou mudar — FAQ/conversas/catálogo continuam singleton.

Tripla: migration + apêndice no `baseline.sql` + linha no `MANIFEST.md`.

## 35. Arquivos alterados (desta entrega)

Ver `git show --stat` do commit. Principais: upload, delete, indexer, busca/recuperar, organizar, UI das 4 abas, 0207, `next.config.ts` (`serverExternalPackages`), e2e 3C + knowledge-2.

## 36. Screenshots

`docs/knowledge-2/screenshots/01` … `10` (empty, upload, processando, pronto, testar, citação, texto rápido, organizar, mobile, dark). Sem secrets.

## 37. Resíduos

Working tree ainda tem zips/xray/screenshots de fases visuais e `.cursor/` — **fora deste commit**.

## 38. Blockers

- Organizar com IA exige LLM da instalação (e2e sem chave = 503, comportamento correto).
- Embedder ausente: Testar ainda responde via FAQ/`extracted_text`; retrieve vetorial fica para quando a chave existir.
- Conversas→RAG e Nuvemshop catalog continuam parciais (pré-existente).
- Copilot/assistente/MCP: prova pelo **mesmo retrieve**, sem conversa/WhatsApp/sessão MCP ao vivo.

## 39. Commit

Local, mensagem pedida. Hash no veredito.

## 40. Veredito

Ver bloco final abaixo e `docs/MOOPE_CRM_KNOWLEDGE_2_PROVAS.md`.
