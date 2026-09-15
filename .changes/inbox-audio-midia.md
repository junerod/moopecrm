---
impacto: nada_mudou
secao: corrigido
titulo: Áudio da inbox deixa de aparecer como mídia indisponível
---

O áudio (e o resto da mídia) passa a ser gravado no bucket ainda no
webhook e servido pela própria API, sem redirecionar o player para o
Storage. Abrir a conversa tenta persistir de novo — inclusive pedindo
o arquivo ao aparelho pela sessão WhatsApp que está no ar, quando a
linha antiga da mensagem já caiu.
