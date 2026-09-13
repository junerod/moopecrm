# MOOPE CRM — Vision real — Matriz de provas

Legenda: IMPLEMENTADO / MOCK VALIDADO / REAL VALIDADO / NÃO VALIDADO / PARCIAL.

Não escrever SIM em “prova real” se só houve mock.

| CAPACIDADE | IMPLEMENTADA? | PROVA REAL? | TESTE | EVIDÊNCIA | RISCO RESIDUAL |
|---|---|---|---|---|---|
| Imagem sem TXT auxiliar | SIM | REAL VALIDADO | `knowledge-vision-real.spec.ts` | upload só `Campanha-Locadoras.png`; zero `.txt` na org | — |
| Token só nos pixels | SIM | REAL VALIDADO | unit fixture + e2e banco | `VISION-MOOPE-7319` ausente de TXT/MD/PDF auxiliar; 1 source na org | canvas sintético, não arte final de marketing |
| Provider real | SIM | REAL VALIDADO | `GET knowledge/saude` + metadata | `openai` | precisa de `OPENAI_API_KEY` (ou Anthropic/gateway) no processo do app |
| Modelo real | SIM | REAL VALIDADO | `processing.vision_model` | `openai/gpt-4o` | default Anthropic não resolve só com OpenAI — fallback documentado |
| Vision requested | SIM | REAL VALIDADO | metadata | `vision_requested: true` | — |
| Vision completed | SIM | REAL VALIDADO | metadata | `vision_completed: true`, `pages_vision > 0` | — |
| Resultado persistido | SIM | REAL VALIDADO | `source_metadata` | token no extraído / `texto_visivel` / derived | — |
| Derived chunks | SIM | REAL VALIDADO | metadata + unit | `derived_chunks` com bloco visual | embed/vetor no E2E ainda cai no cadastro se o indexer não drenou |
| Query do token visual | SIM | REAL VALIDADO | consultar | resposta contém `VISION-MOOPE-7319` | matcher FAQ é OR de termos |
| Citação da imagem | SIM | REAL VALIDADO | consultar | `Campanha-Locadoras.png`; sem `.txt`; sem “resumo da IA” | — |
| Recursos da propaganda | SIM | REAL VALIDADO | consultar | Locações, Financeiro, PIX, etc. | — |
| Anti-alucinação SAP | SIM | REAL VALIDADO | aba Testar | não afirma integração com SAP | — |
| PDF visual | SIM | REAL VALIDADO | e2e `Manual-Teste.pdf` | `TELA-VISION-8821` só em JPEG; retrieve `8821`; citação `Manual-Teste.pdf` | PDF 1.4 mínimo; um caso |
| Reprocess reexecuta Vision | SIM | REAL VALIDADO | POST reindex | `derived_revision` incrementa; `vision_processed_at` muda | custo de uma chamada extra |
| Reprocess não duplica | SIM | REAL VALIDADO | count sources = 1 | mesmo `source_id` | — |
| Reprocess preserva coleção | SIM | REAL VALIDADO | metadata | `collection_ids` Comercial após reprocess | — |
| Falha segura no reprocess | SIM | MOCK VALIDADO | unit `fundirReprocessamentoVisual` | derivado anterior permanece | falha real de provider não forçada no E2E |
| Coleção Comercial | SIM | REAL VALIDADO | e2e | imagem linkada | — |
| Agente Suporte isolado | SIM | REAL VALIDADO | consultar com coleção suporte | token comercial ausente | — |
| Tenant B | SIM | REAL VALIDADO | org B Testar | vazio; sem `VISION-MOOPE-7319` na resposta | — |
| Escolha de modelo | SIM | REAL VALIDADO | unit + e2e | OpenAI resolve quando Anthropic não tem credencial | — |
| Fallback sem Vision | SIM | MOCK VALIDADO | unit | `vision_unavailable` | CI sem chave: spec Vision dá skip |
| R2 real | NÃO | NÃO VALIDADO | — | fora desta certificação | item de infra separado |
| typecheck | VERDE | REAL VALIDADO | `pnpm typecheck` | exit 0 | — |
| test:db | VERDE | REAL VALIDADO | `pnpm test:db` | 130 / 1016 | sem migration |
| E2E Vision real | VERDE | REAL VALIDADO | `knowledge-vision-real.spec.ts` | 1 passed, 26.7s | sem mock |
| E2E Knowledge 2 | VERDE | REAL VALIDADO | `knowledge-2.spec.ts` | 1 passed | — |
| E2E documentos reais | VERDE | REAL VALIDADO | `knowledge-documents-real.spec.ts` | 1 passed | PDF escaneado pode ficar `ready` se Vision ler |
| E2E multimodal | VERDE | REAL VALIDADO | `knowledge-multimodal.spec.ts` | 1 passed | retrieve comercial ainda pode usar TXT irmão neste spec (de propósito) |
