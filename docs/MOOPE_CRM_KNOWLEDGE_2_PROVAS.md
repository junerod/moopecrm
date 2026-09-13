# MOOPE CRM — Knowledge 2.0 — Matriz de provas

| Capacidade | Implementada? | Teste? | Evidência | Risco residual |
|---|---|---|---|---|
| Upload PDF | SIM | E2E `knowledge-2` 201 | `05-testar-resposta.png`, rota upload | PDF escaneado continua recusado (sem OCR) |
| Extração | SIM | Unit `pdf-extractor` + `knowledge-2-pipeline` + e2e | pdfjs-dist; 422 sem texto | `next start` precisa de `serverExternalPackages` |
| Chunking | SIM | Unit `pedacosDePolitica` / `chunkPolicyText` | `lib/ai/rag/ingest/policy.ts` | Página só se o extrator devolver |
| Embedding | SIM (reuso) | Indexer + `isEmbeddingProviderConfigured` | `text-embedding-3-small` | Sem chave, vetor não grava; Testar usa cadastro |
| pgvector | SIM (reuso) | `test:db` + RPC existente | `ai_chunks.embedding vector(1536)` | — |
| Retrieval | SIM | E2E pergunta diária/código | `buscarConhecimento` + FAQ/`extracted_text` | Limiar vetorial 0.35 no Copilot |
| Citation | SIM | E2E Fontes utilizadas | `06-citacao.png` — `Gerador-Industrial-MOOPE.pdf` | Página omitida se não vier do extrator |
| Delete | SIM | E2E pergunta some | chunks + archive + blob | Rebuild assíncrono; chunks saem na hora |
| Reprocess | SIM | E2E clique Reprocessar | `triggered_by=manual_reindex` | Precisa embedder para nova versão vetorial |
| Tenant isolation | SIM | Unit + E2E org B | body B sem AZUL-9271 / 347,80 | — |
| Copilot | SIM (mesmo retrieve) | Unit `ai-copilot-gerar` anti-alucinação | `recuperarConhecimentoDaEmpresa` | Sem conversa aberta nesta rodada |
| Assistente | SIM (mesmo retrieve) | Código `searchKnowledge` | mesma KB ativa | Sem WhatsApp / autonomous |
| MCP | SIM (mesmo retrieve) | `crm_search_knowledge` | `lib/mcp/tools/evolucao.ts` | Sem sessão MCP ao vivo |
| Texto rápido | SIM | E2E 3C + knowledge-2 | `07-texto-rapido.png` | — |
| Organizar com IA | SIM | Unit prompt + e2e 503 | rota `organizar`; preview se houver LLM | e2e sem modelo de chat |
| Mobile | SIM | E2E 390, sem overflow | `09-mobile.png` | Abas quebram linha (ok) |
| Dark | SIM | E2E theme-option-dark | `10-dark.png` | — |
| Anti-alucinação | SIM (reuso) | E2E Blumenau vazio + unit Copilot | sem segundo policy engine | — |
| Conversas→RAG | PARCIAL | Documentado | cron próprio; copy-forward no rebuild | Batch de conversas ainda ativa versão só dela |
| Nuvemshop catálogo | PARCIAL | Documentado | handler sem emit TS vivo | Não construir nesta rodada |
