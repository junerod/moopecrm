---
impacto: nada_mudou
secao: corrigido
titulo: Boleto pelo CRM respeita o ritmo do número
---

O /send da locadora passou a obedecer o pacing proativo (5s, janela,
warm-up). Cem POSTs de uma vez viram 429 com Retry-After — o WhatsApp
não leva a rajada.
