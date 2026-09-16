---
impacto: nada_mudou
secao: corrigido
titulo: Abrir CRM da locadora entra logado
---

O botão Abrir CRM na locadora passava a criar a sessão e a aba nova
caía no login: o cookie Strict não sobrevivia o redirect vindo de outro
domínio. O clique agora termina numa página deste CRM que abre o
atendimento já autenticado. O WhatsApp da locadora também passa a
consultar retrato, boleto e oferta na gestão, em vez de só o copiloto
humano ter essas ferramentas.
