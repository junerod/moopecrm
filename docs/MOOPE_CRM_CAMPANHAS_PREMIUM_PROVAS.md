# Campanhas Premium — matriz de provas

| CAPACIDADE | IMPLEMENTADA? | PROVA REAL? | TESTE | EVIDÊNCIA | RISCO |
|---|---|---|---|---|---|
| Wizard /nova 6 passos | SIM | Código + E2E escrito | campaigns-premium / bloco-3 | `app/app/campanhas/nova/_client.tsx` | Médio — E2E desta sessão não executado |
| Objetivos | SIM | Código | — | `lib/campanhas/objetivo.ts` | Baixo |
| Segmentação avançada | SIM | Unit | `canais.test.ts` `segmento.test.ts` | API já filtrava; UI expõe | Baixo |
| Preview destinatários | SIM | Código | E2E escrito | `campanha-ver-contatos` | Baixo |
| Modelos Pack | SIM | Código | E2E escrito | GET `/modelos` → `message_templates` | Médio se pack não ativo |
| Texto | SIM | Unit preview | preview.test.ts | Composer | Baixo |
| Imagem | SIM | Unit + fixture PNG | midia.test.ts | Upload Storage | Médio sem bucket |
| Vídeo | SIM (validação) | Unit mime | midia.test.ts | Sem fixture mp4 no E2E | Médio |
| PDF | SIM | Unit + fixture PDF | midia.test.ts | Upload | Médio |
| WhatsApp | PARCIAL | Dispatcher + seam | dispatcher.test.ts worker.test.ts | Real só canal oficial + template | Alto se operador espera QR |
| E-mail | PARCIAL | Envelope + `sendEmail` | `email-envelope.ts` (sem teste dedicado) | Real se Resend/mailserver | Alto sem transport |
| Ambos | SIM | Unit roteamento | canais.test.ts | 2 rows unique | Baixo |
| Preview WA/e-mail | SIM | Código | E2E escrito | Abas no passo conteúdo/revisar | Baixo |
| Agendar | SIM | Código | transições + wizard | `scheduled_at` | Baixo |
| Enviar agora | SIM | Código | start + worker | preparing → running | Baixo |
| Materialização async | SIM | Código + test:db verde | materializar.ts | POST não faz 5k inserts | Baixo no schema; médio no E2E |
| 5.000 no POST | NÃO (corrigido) | Código | start/route.ts | Só marca preparing | — |
| Fila/progresso | SIM | Código | detalhe polling | `campanha-progresso` | Baixo |
| Entregues | PARCIAL | Métrica | metricas.ts | Null no mock | Esperado |
| Lidas | PARCIAL | Métrica | metricas.ts | Só se provider informar | Esperado |
| Respondidas | SIM | Worker existente | worker.ts | Inbound após envio | Médio |
| Falhas | SIM | Dispatcher | worker.ts | status failed + motivo | Baixo |
| Opt-out | SIM | Unit + guarda | consentimento | skipped consent_declined | Baixo |
| Status PT | SIM | Código | rotulos.ts | detalhe usa rótulo | Baixo |
| Cancelamento | SIM | Código | worker cancel + corrida | pending → cancelled | Médio |
| Tenant isolation | SIM | RLS existente | invariantes | org_id em toda query | Baixo |
| IA draft sem enviar | SIM | Unit + rota | ia-rascunho | `enviou: false` | Baixo |
| Pack integrado | SIM | Código | modelos | sem campanha auto | Baixo |
