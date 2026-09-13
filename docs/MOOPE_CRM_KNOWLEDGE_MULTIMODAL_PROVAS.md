# MOOPE CRM — Knowledge multimodal — Matriz de provas

Legenda: IMPLEMENTADO / MOCK VALIDADO / REAL VALIDADO / NÃO VALIDADO / PARCIAL.

Não escrever SIM em “prova real” se só houve mock.

| CAPACIDADE | IMPLEMENTADA? | PROVA REAL? | TESTE | EVIDÊNCIA | RISCO RESIDUAL |
|---|---|---|---|---|---|
| PDF textual | SIM | REAL VALIDADO | unit documentos + e2e multimodal/knowledge-2 | extração pdfjs + retrieve `TELA-CLICK-4401` | linha longa do PDF 1.4 sintético corta no fim |
| PDF multipage | SIM | REAL VALIDADO | `knowledge-documentos-reais` | `pdf-multipage.pdf` pageCount ≥ 2 | Vision por página só se heurística pedir |
| PDF escaneado | PARCIAL | REAL VALIDADO (needs_ocr) | unit + e2e documentos reais | `pdf_needs_ocr` / “OCR necessário” | sem OCR configurado não vira texto |
| DOCX | SIM | REAL VALIDADO | e2e documentos reais | `918,40` / `DOCX-5512` | — |
| TXT/MD | SIM | REAL VALIDADO | e2e documentos + multimodal | TXT comercial + injeção | — |
| PNG/JPG/WEBP | SIM | REAL VALIDADO (upload) | unit magic + e2e PNG 201 | `campanha-png.ts` + lista de documentos | retrieve do **pixels** depende de Vision |
| Heurística Vision | SIM | MOCK VALIDADO | unit `decidirVisionNaPagina` | teto 6; texto longo sem imagem = não | `temImagem` no PDF ainda é proxy (texto < 80) |
| OCR | PARCIAL | MOCK/EXISTENTE | unit status + documentos reais | OCR ≠ Vision documentado | provider opcional |
| Vision arquitetura | SIM | IMPLEMENTADO | `analisarDocumentoVisual` + capabilities | gateway/providers existentes | sem env nova |
| Vision mock | SIM | MOCK VALIDADO | unit generate injetado | JSON factual `Gestão de Sinistros` | — |
| Vision real | NÃO | NÃO VALIDADO | — | E2E não observou `pages_vision > 0` | não marcar SIM |
| Normalização IA | SIM | MOCK VALIDADO | unit `model: null` preserva 347,80 | LLM só se gateway | sem LLM = original |
| Conhecimento derivado | SIM | MOCK VALIDADO | unit `chunksDoDerivado` | UI “O que a MOOPE aprendeu” no e2e (sem resumo se sem LLM) | E2E viu fallback “ainda não há resumo” |
| Chunks originais | SIM | REAL VALIDADO | indexer + e2e retrieve | FAQ/`extracted_text` | embed precisa de chave |
| Chunks derivados | SIM | IMPLEMENTADO | indexer `derived_chunks` | metadata `ai_derived` | sem Vision/LLM a lista fica vazia |
| Embedding | SIM | PARCIAL | reuso indexer | `text-embedding-3-small` | E2E usou cadastro, não vetor |
| pgvector | SIM | REAL VALIDADO | `test:db` | RPC `retrieve_top_k_chunks` | — |
| Retrieval | SIM | REAL VALIDADO | e2e Testar + consultar | mesmo `buscarConhecimento` | matcher FAQ é OR de termos |
| Citação na fonte original | SIM | REAL VALIDADO | e2e fontes Manual.pdf / Campanha.txt | `citacaoDaFonteOriginal` | nunca inventa página |
| Dedup original+derivado | SIM | MOCK VALIDADO | unit `consolidarOriginalEDerivado` | 1 hit por source+página | — |
| Coleções | SIM | REAL VALIDADO | e2e criar Suporte/Comercial + PATCH | settings JSONB | sem tabela nova |
| Agente restringe coleções | SIM | REAL VALIDADO | e2e suporte ≠ Campanha; comercial = Campanha | `knowledge_collection_ids` | fonte sem tag some se o agente restringe |
| Copilot usa Knowledge | SIM | IMPLEMENTADO | `recuperarConhecimentoDaEmpresa` | Testar usa a mesma função | sem conversa Copilot aberta |
| Assistente usa Knowledge | SIM | IMPLEMENTADO | `search_knowledge` + coleção | inbound-turn | sem turno WhatsApp |
| MCP usa Knowledge | SIM | IMPLEMENTADO | `crm_search_knowledge` | mesmo `buscarConhecimento` | sem sessão MCP ao vivo |
| Prompt injection documental | SIM | REAL VALIDADO (conteúdo) | unit + e2e “12 por cento” | embrulho no turno | consultar não executa comando; prova de “não mudou policy” é unit/código |
| Tenant isolation original | SIM | REAL VALIDADO | e2e org B vazio / sem 847,35 | JWT + RPC | — |
| Tenant isolation derivado | SIM | IMPLEMENTADO | mesmo filtro de org | derivado vive na mesma fonte | sem derivado real no E2E |
| Supabase storage | SIM | REAL VALIDADO | upload e2e | default provider | — |
| R2 mock | SIM | MOCK VALIDADO | `knowledge-documentos-reais` | put/get/delete prefixo tenant | — |
| R2 real | NÃO | NÃO VALIDADO | — | não retestado nesta rodada | não copiar prova de sessão anterior |
| Delete remove retrieval | SIM | REAL VALIDADO | e2e manual some | `TESTE-MULTIMODAL-9271` vazio depois | — |
| Reprocess não duplica | SIM | REAL VALIDADO | e2e count fontes estável | uma versão ativa | Vision não re-roda |
| Fallback sem Vision | SIM | MOCK VALIDADO | unit enriquecer | `vision_unavailable` | — |
| Fallback sem LLM | SIM | MOCK VALIDADO | normalizar/derivado | original intacto | — |
| Mobile 390 | SIM | REAL VALIDADO | e2e | `10-mobile.png` sem overflow | 8/10 |
| Light | SIM | REAL VALIDADO | e2e default | 01–09 | 8/10 |
| Dark | SIM | REAL VALIDADO | e2e theme dark | `11-dark.png` | 8/10 |
| typecheck | VERDE | REAL VALIDADO | `pnpm typecheck` | exit 0 | — |
| test:db | VERDE | REAL VALIDADO | `pnpm test:db` | 130 / 1016 | sem migration |
| E2E multimodal | VERDE | REAL VALIDADO | `knowledge-multimodal.spec.ts` | 1 passed, 26.2s | retrieve visual da imagem = TXT irmão |
| Regressão Knowledge 2 | VERDE | REAL VALIDADO | `knowledge-2.spec.ts` | 1 passed | — |
| Regressão documentos reais | VERDE | REAL VALIDADO | `knowledge-documents-real.spec.ts` | 1 passed | — |
| Productization 3C | NÃO RE-EXECUTADO | NÃO VALIDADO nesta rodada | — | heading sr-only preservado | risco baixo |

Não afirmar VISION REAL ou R2 REAL sem a linha acima.
