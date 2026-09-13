# MOOPE CRM — Ingestão documental real — Resultado

## 1. PDF real que falhou

Um PDF enviado na VPS após o Knowledge 2.0 voltou:

> “Não foi possível encontrar texto neste documento.”

O arquivo privado **não estava no workspace** desta sessão. Não foi commitado.
Diagnóstico foi pelo código + fixtures reais, não pelo conteúdo do cliente.

## 2. Causa

O upload só aceitava sucesso de `extractPdfDocument` (`pdfjs-dist`). Zero texto
→ `PdfExtractError` → 422 genérico. Não havia:

- classificação (textual / pouco texto / só imagem / criptografado / corrompido);
- segunda estratégia de extração;
- OCR;
- DOCX.

O E2E anterior usava `montarPdfTextual()` — o mesmo universo controlado do parser.

## 3. Parser atual (antes)

Uma engine: `lib/ai/rag/extractors/pdf.ts` → `pdfjs-dist/legacy`.
Issue #238 já proibiu `pdf-parse` (é o mesmo pdf.js de 2018).

## 4. Novo pipeline

```
arquivo → extractDocument(buffer, mime, filename)
       → pdf | docx | md | txt
PDF: pdfjs → qualidade → (se insuficiente) parser de operadores/FlateDecode
     → (se ainda IMAGE_ONLY/LOW_TEXT e OCR_PROVIDER≠none) OCR
     → TEXTUAL | LOW_TEXT | IMAGE_ONLY | ENCRYPTED | CORRUPT
```

Contrato comum em `lib/ai/rag/extractors/contrato.ts`.
O RAG continua no indexer / `retrieve_top_k_chunks` — sem segundo vector DB.

## 5. Fallback

**Escolha:** `lib/ai/rag/extractors/pdf-fluxo.ts` — lê streams, infla
`/FlateDecode` e coleta literais `Tj`/`TJ`. Não é pdfjs e não é `pdf-parse`.

Documentado no arquivo: a issue #238 já pagou a lição de “duas engines iguais”.

## 6. OCR

Arquitetura opcional: `OCR_PROVIDER=none|tesseract`.

- Default `none` — PDF escaneado **é aceito**, status `needs_ocr`, mensagem
  “Este PDF parece ser digitalizado…”.
- `tesseract` — `tesseract.js` + render de página (`pdfjs` + canvas) só nas
  páginas sem texto. Máx. 10 páginas. Não gasta OCR em PDF textual.

`vision` está no tipo, sem provider implementado nesta rodada.

## 7. DOCX

`mammoth` (`extractDocx`). Texto, headings (`<h1–3>`) e tabelas em linha
(`célula | célula`). Fixture `docx-compressor.docx`: 918,40 + DOCX-5512 + seção
“Locacoes”.

## 8. TXT / MD

`extractPlainText` / `extractMarkdownDocument`. Headings `#` viram seção para
citação. Fixtures `regras.txt` (TXT-4401) e `garantias.md` (MD-2208 / “Garantias”).

## 9. R2

Cloudflare R2 via `@aws-sdk/client-s3` (S3-compatible).

Env (opcional, default não quebra instalação):

- `KNOWLEDGE_STORAGE_PROVIDER=supabase|r2` (default `supabase`)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_KNOWLEDGE=moope-knowledge`
- `R2_ENDPOINT`

Não lê `.env` de outro projeto. Token deve ser restrito ao bucket do CRM.

## 10. Storage abstraction

`DocumentStorage` (`put` / `get` / `delete` / `exists`):

- `supabaseDocumentStorage` — bucket `ai-policy`
- `r2DocumentStorage` — bucket `moope-knowledge`

Resolver: novos uploads usam `storagePadrao()`; reprocess/delete usam
`source_metadata.storage_provider` (default supabase se ausente).

Path: `{organizationId}/{sourceId}/{filename}`

Metadata: `storage_provider` + `storage_key` + `blob_path` (compat).

## 11. Backward compatibility

Documentos antigos com só `blob_path` no Supabase continuam. Reprocess lê o
provider gravado. Sem migração automática Supabase→R2.

## 12. Security

- Credencial R2 só no servidor.
- Sem URL pública permanente.
- Path recusado se não começa com `{orgId}/`.
- GET/SSR não devolvem `blob_path`, `storage_key`, `extracted_text`.
- Senha de PDF nunca é pedida nem logada.

## 13. Tenant

Org B não gera path nem lê objeto da A (`chavePertenceAOrg`). Isolation E2E
repete a pergunta do PDF real na org vizinha e espera vazio.

## 14. Citations

- PDF: `{filename} · página N` quando `metadata.page` existe.
- DOCX/MD: `{filename} · seção "…"` quando `metadata.section` existe.

## 15. Tests

- Unit: `tests/unit/knowledge-documentos-reais.test.ts` (fixtures reais, R2 mock,
  classificação, mensagens, tenant path).
- E2E: `tests/e2e/knowledge-documents-real.spec.ts` (SPECS_PARTE_2).
- Knowledge 2 sintético permanece.

## 16. Fixtures reais

`tests/fixtures/knowledge/` — **não** geradas por `montarPdfTextual`:

| Arquivo | Origem |
|---|---|
| `pdf-real-plataforma.pdf` | PDF 1.4 com stream **FlateDecode** (zlib) |
| `pdf-multipage.pdf` | 2 páginas, fonte Courier |
| `pdf-layout-courier.pdf` | layout/fonte diferente |
| `pdf-escaneado.pdf` | cópia de `sample-sem-texto.pdf` (externo) |
| `pdf-protegido.pdf` | trailer `/Encrypt` |
| `docx-compressor.docx` | OOXML via `fflate` |
| `docx-paragrafos.docx` | OOXML |
| `regras.txt` / `garantias.md` | texto |

Gerador: `tests/fixtures/knowledge/montar-fixtures.ts`.

## 17. R2 tests

Mock S3 (`put`/`get`/`delete`/`exists` + recusa de org vizinha). Sem credencial
R2 de teste no CI — **não** há integração contra bucket real.

## 18. E2E

`knowledge-documents-real.spec.ts` — **1 passed** (15.7s) contra `next start`:
PDF real → 742,30 + citação; DOCX → 918,40; TXT-4401; escaneado → 201 needs_ocr;
protegido → 422 `pdf_encrypted`; org B não vê o PDF da A.

## 19. test:db

Verde: 130 arquivos / 1016 passed (1 expected fail, 1 skipped).

## 20. typecheck

**VERDE.** Os 3 erros pré-existentes eram só tipagem de teste
(`as unknown as SnapshotDaHome`, `organizations: []` no mock de `AuthUser`).
Nenhuma regra de produto mudou.

## 21. Migrations

`0208_ai_policy_aceita_docx` — `allowed_mime_types` do bucket `ai-policy` inclui
DOCX. Apêndice no `baseline.sql` + linha no MANIFEST. Sem coluna nova de status
(estados extra vivem em `source_metadata.extract_status`).

## 22. Residuals

- XLSX não implementado.
- OCR `vision` não implementado.
- Sem health UI (só `saudeDoConhecimento()` interno).
- Sem signed URL de download do original.
- Sem migração em lote Supabase→R2.
- Conversas→RAG e catálogo Nuvemshop seguem parciais (pré-existente).
- Organizar com IA não foi mexido.

## 23. Blockers

- Sem `OCR_PROVIDER=tesseract` (e binário/canvas), PDF escaneado não vira texto.
  O produto agora **diz isso** em vez de 422 genérico.
- Sem `OPENAI_API_KEY`, retrieve vetorial não roda; Testar usa FAQ/`extracted_text`.
- R2 só entra com env da instalação; default continua Supabase.

## 24. Commit

Local, se os gates desta rodada passarem: `feat(ai): harden document knowledge ingestion`.
**Push: NÃO.**
