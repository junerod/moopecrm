# MOOPE CRM — Certificação Vision real do Knowledge

Fecha os dois resíduos da certificação multimodal anterior. Não é Knowledge 3.0.

## 1. Base

- HEAD de partida: `b218498a` — `feat(ai): add multimodal knowledge and collections`
- Push: **não feito**

## 2. Por que a rodada anterior não chamou Vision

Três causas, medidas:

1. O E2E comercial consultava `Campanha-Locadoras.txt`, irmão textual da imagem. Retrieve verde **não** prova pixels.
2. `visionDisponivel()` perguntava se o default `anthropic/claude-sonnet-5` *declara* capability `image`. Com `OPENAI_API_KEY` a instalação “tinha IA”, mas `resolveLanguageModel("anthropic/…")` devolvia `null`.
3. `.env.e2e` não tem chave de chat. Sem injetar `OPENAI_API_KEY` no `next start` do Playwright, o servidor do E2E não resolve modelo.

Nenhum secret foi impresso. Nesta máquina: `.env.local` tem `OPENAI_API_KEY` (set, 164 chars). `.env.e2e` / `.env`: chaves de chat ausentes.

## 3. O que foi corrigido

| Peça | Efeito |
|---|---|
| `escolherModeloVision()` | Tenta o default; se não resolve, cai em `openai/gpt-4o` quando a chave OpenAI existe |
| Upload | Imagem e PDF (inclusive `needs_ocr`) tentam Vision; PDF escaneado só fica `ready` se `pages_vision > 0` |
| Extração | `extractedText` e FAQ passam a incluir o **texto visível**, não só a prosa |
| PDF sem páginas nativas | Vision grava página 1 com o bloco visual (antes o derivado existia e o retrieve não achava) |
| Reprocessar | Relê o original no storage da fonte, refaz extração + Vision, incrementa `derived_revision` |
| Falha no reprocess | Se Vision falha e já havia derivado válido, o anterior permanece (`vision_reprocess_preserved_previous`) |
| Metadata JSONB | `vision_requested`, `vision_completed`, `vision_processed_at`, `vision_model`, `vision_provider`, `vision_latency_ms`, `vision_usage`, `derived_revision` — sem coluna nova |
| `GET /api/v1/ai/knowledge/saude` | Diagnóstico sem secret |

## 4. Estratégia segura de falha no reprocess

Não destruir conhecimento válido antes de existir substituto:

- Vision **completa** (`pages_vision > 0` + `derived_chunks`): troca o derivado e soma 1 em `derived_revision`.
- Vision **falha** e já havia derivado: mantém `derived_chunks`, `visual_pages`, `extracted_text` e a revisão; marca `vision_reprocess_preserved_previous`.
- Fonte nova sem derivado: fica `vision_unavailable` / `needs_ocr`. Não inventa texto.

Uma fonte. Sem segunda linha. Coleção e provenance do original permanecem.

## 5. Prova de imagem (somente pixels)

- Fixture: `Campanha-Locadoras.png` (canvas). Token `VISION-MOOPE-7319` **só nos pixels**.
- Nenhum TXT/MD/PDF auxiliar contém esse token (unit + checagem no banco da org).
- Upload **somente** a PNG.
- Vision real: `openai` / `openai/gpt-4o`.
- Pergunta do código → resposta com `VISION-MOOPE-7319`.
- Citação: `Campanha-Locadoras.png`. Não `.txt`. Não “resumo da IA”.
- Recursos da propaganda sustentados pelo texto visível extraído.
- “Integração com SAP?”: não inventa.

## 6. Prova de PDF visual

- `Manual-Teste.pdf` = uma página JPEG com `TELA-VISION-8821` só nos pixels.
- Vision leu, gravou página, retrieve por `8821`, citação `Manual-Teste.pdf`.

## 7. Reprocess

Upload → `derived_revision = 1` → Reprocessar → Vision de novo → revisão incrementa → `source_id` igual → uma fonte ativa → coleção Comercial preservada.

## 8. Evidência obrigatória

```
VISION REQUESTED: SIM
VISION PROVIDER: openai
VISION MODEL: openai/gpt-4o
VISION COMPLETED: SIM
VISION RESULT STORED: SIM
DERIVED CHUNKS CREATED: SIM
QUERY FOUND VISUAL-ONLY TOKEN: SIM
CITATION ORIGINAL IMAGE: SIM
```

VISION REAL VALIDADA: **SIM**

## 9. Coleções e tenant

- Imagem na coleção Comercial. Agente só-Suporte não recupera o token. Agente Comercial recupera.
- Org B pergunta `VISION-MOOPE-7319` → vazio.

## 10. Gates

- `pnpm typecheck` — verde
- `pnpm test:db` — 130 arquivos, 1016 passed
- E2E: `knowledge-vision-real.spec.ts` 1 passed (26.7s) com `OPENAI_API_KEY` injetada no Playwright
- Regressão: `knowledge-2` + `knowledge-documents-real` + `knowledge-multimodal` — 3 passed

R2 real: **não faz parte desta certificação.**

## 11. Veredito

MOOPE CRM — VISION REAL VALIDADA: SIM

IMAGEM SEM TXT AUXILIAR: SIM
VISION PROVIDER REAL: SIM
VISION MODEL REAL: openai/gpt-4o
PIXELS → DERIVADO: SIM
DERIVADO → CHUNKS: SIM
CHUNKS → RETRIEVAL: SIM
RETRIEVAL → RESPOSTA: SIM
CITAÇÃO DA IMAGEM ORIGINAL: SIM

PDF COM CONTEÚDO VISUAL REAL: SIM

REPROCESS REEXECUTA VISION: SIM
REPROCESS NÃO DUPLICA: SIM
REPROCESS PRESERVA COLEÇÕES: SIM

COLEÇÃO COMERCIAL: SIM
AGENTE SUPORTE NÃO VÊ COMERCIAL: SIM
TENANT B NÃO VÊ IMAGEM DA A: SIM
ANTI-ALUCINAÇÃO: SIM

TYPECHECK: VERDE
TEST:DB: 130 arquivos / 1016 passed
E2E: knowledge-vision-real + knowledge-2 + knowledge-documents-real + knowledge-multimodal — 4 passed

R2 REAL:
NÃO FAZ PARTE DESTA CERTIFICAÇÃO

BLOCKERS:
NENHUM

PRONTO PARA USO INTERNO MULTIMODAL:
SIM

PRONTO PARA PILOTO CONTROLADO MULTIMODAL:
SIM — desde que a instalação tenha modelo multimodal resolvível (OpenAI com visão, Anthropic, OpenRouter ou AI Gateway). Sem isso o upload não quebra; a análise visual fica marcada indisponível.

COMMIT LOCAL:
PUSH: NÃO
