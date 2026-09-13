# MOOPE CRM — Ingestão documental real — Provas

| Caso | Status | Evidência |
|---|---|---|
| PDF textual real | PASS | `tests/unit/knowledge-documentos-reais.test.ts` — fixture `pdf-real-plataforma.pdf` (FlateDecode, não `montarPdfTextual`) extrai `742,30` e `PDFREAL-8127` |
| PDF multi-page | PASS | Mesmo arquivo de teste — `pdf-multipage.pdf`, `pageCount >= 2` |
| PDF image-only | EXPECTED NEEDS_OCR | `pdf-escaneado.pdf` → `errorCode=pdf_needs_ocr`, `classification=IMAGE_ONLY` |
| PDF protected | PASS | `pdf-protegido.pdf` → `DocumentExtractError` `pdf_encrypted` |
| DOCX | PASS | `docx-compressor.docx` via mammoth — `918,40`, `DOCX-5512`, seção Locacoes |
| TXT | PASS | `regras.txt` — `TXT-4401` |
| MD | PASS | `garantias.md` — `MD-2208`, seção Garantias |
| R2 put/get/delete | MOCK VALIDADO | cliente S3 fake no mesmo teste; prefixo `{org}/{source}/…`; org B recusada |
| R2 real | NÃO CONFIGURADO | sem credencial de teste no CI |
| Supabase compatibility | PASS | default `KNOWLEDGE_STORAGE_PROVIDER=supabase`; path legado `blob_path` ainda lido |
| Tenant isolation | PASS | unit `chavePertenceAOrg`; E2E org B não vê `742,30` / `PDFREAL-8127` |
| Retrieval | PASS (unit + cadastro) | extração alimenta `extracted_text`/`pages` + FAQ; vetor depende de embed key |
| Citation | PASS (código + unit DOCX/MD seção) | `fonte · página N` / `fonte · seção "…"` em Testar |
| Delete | PASS (código) | `storageDaFonte(meta)` — nunca apaga no provider errado |
| Reprocess | PASS (código) | indexer passa `storage_provider` / `storage_key` a `ingestPolicyFile` |
| Mensagem genérica removida no fluxo novo | PASS | `pdf_needs_ocr` fala “digitalizado”; `pdf_encrypted` fala “senha” |
| typecheck | PASS | `pnpm typecheck` verde |
| test:db | PASS | 130 files / 1016 passed |
| E2E `knowledge-documents-real.spec.ts` | PASS | Playwright 1 passed (15.7s): PDF real 742,30 + DOCX 918,40 + TXT + MD + needs_ocr + pdf_encrypted + isolamento org B |
| E2E `knowledge-2.spec.ts` (regressão sintética) | PASS | 1 passed (14.2s) — circuito sintético + delete + isolamento intactos |
| productization-3c | NÃO RE-EXECUTADO nesta rodada | abas/testids 3C preservados |

Não escrever SIM sem a linha de evidência acima.
