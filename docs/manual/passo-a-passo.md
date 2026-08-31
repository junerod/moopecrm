# Passo a passo — como usar o MOOPE CRM

Roteiro de trabalho. Os nomes entre aspas são os da tela. O mapa de todas as telas está em [`README.md`](README.md).

Login é **e-mail + senha**. A senha precisa ter **pelo menos 8 caracteres**. Não existe usuário sem e-mail.

---

## 1. Primeiro acesso

### Se a organização ainda não terminou o passo a passo inicial

Depois do login o sistema leva ao wizard. A ordem (e só estes passos — a loja Nuvemshop **não** aparece):

1. **Seu negócio** — o que a empresa faz, nome, fuso. Isto decide o quadro que vem depois.
2. **O telefone dele** — conectar o WhatsApp (QR) ou pular e conectar depois em Canais › Conexões.
3. **Treinar** — cria o primeiro agente. Se a instalação não tem chave de IA, a tela pede a chave **aqui**, não em outro menu.
4. **Onde ele organiza** — o quadro de clientes (funil). Locadora ganha Locatários + Cobrança; escritório ganha Novos clientes + Processos.
5. **Ver ele atender** — ensaio. Nada sai no WhatsApp de verdade.
6. **Quem trabalha com ele** — convites. Se o e-mail da instalação não estiver configurado, a tela mostra o link para copiar; ela não finge que o convite saiu.

No fim, **Começar a usar** abre o Inbox.

Verificação em duas etapas (MFA) **não** é obrigatória. Quem quiser liga em Configurações › Segurança.

### Se a conta já está pronta

Abra o endereço do CRM → e-mail → senha. Cai no Inbox (ou no último lugar em que estava).

Esqueceu a senha: use a recuperação da tela de login. Convite recebido por e-mail: o link leva ao aceite; quem ainda não tem conta escolhe “Ainda não tenho conta” no próprio fluxo — não crie uma empresa nova no cadastro livre.

---

## 2. Conectar o WhatsApp

Precisa ser **administrador**.

1. Menu **Canais › Conexões**.
2. Aba **Números por QR**.
3. **Conectar novo WhatsApp**.
4. No celular: WhatsApp → **Aparelhos conectados** → **Conectar um aparelho** → aponte a câmera para o QR da tela.
5. O QR muda sozinho a cada ~15–20 s. Se expirou, **Gerar novo QR**.
6. Espere o estado virar conectado (o sistema chama isto de WORKING). Sem isto, Inbox e agente não têm canal.

**Reconectar** o mesmo número: o botão de reconectar na linha. Contatos do aparelho voltam a entrar. Conversas **novas ou recentes** aparecem no Inbox aos poucos (janela de cerca de 48 h, no máximo 40 fios por rodada). Conversa antiga de meses **não** entra sozinha no Inbox — abra o contato e importe o histórico dali, se precisar do texto.

Canal oficial da Meta (aba ao lado) é outro caminho: credencial da Meta, não QR. Templates oficiais só existem nesse caminho.

---

## 3. Mandar e receber mensagem

1. **Atendimento › Inbox**.
2. À esquerda, a lista de conversas. Clique numa.
3. Embaixo, o campo de texto. Escreva e aperte **Enter** (ou o botão Enviar).
4. Atalho **A** ou o botão **Assumir**: você fica com a conversa e o automático cala a boca.
5. **`/`** no começo da linha abre Respostas rápidas.
6. O **+** anexa foto, vídeo, documento ou contato. Dá para gravar áudio e mandar emoji.

A janela de 24 h do WhatsApp (número não oficial / QR) fecha o envio livre quando o cliente parou de falar há mais de um dia. O aviso acima do campo diz o motivo. Número oficial da Meta usa **modelo** (template) para furar essa janela — **Enviar modelo**.

A IA só responde mensagem **nova** que chega pelo WhatsApp ao vivo. Texto puxado do histórico do aparelho entra no CRM marcado como histórico: o agente **não** responde essas.

Se a lista está vazia (“Sem conversas por aqui”): ou o número não está conectado, ou ainda ninguém falou depois da conexão, ou os fios recentes ainda estão na rodada de sincronização. **Contatos** enche antes do Inbox — isso é esperado.

---

## 4. Contatos e o quadro (funil)

### Contatos

**CRM › Contatos**. A lista enche com quem já está no aparelho, depois que o WhatsApp conecta.

Para trazer a conversa antiga de **uma** pessoa: abra o contato → importar conversa. Isto grava o texto; **não** liga a IA em cima desse passado.

### Funis (o quadro)

1. **CRM › Funis**.
2. Clique no funil (Locatários, Cobrança, Novos clientes, …).
3. Cada coluna é uma etapa. Arraste o card para mover.
4. Clique no card para ver a pessoa, a conversa e o histórico.

### Mudar as colunas

**CRM › Etapas do funil** (gerente ou admin). Aqui se renomeia coluna, vocabulário do negócio e motivos de perda.

### Trocar o tipo de negócio

**Configurações › Perfil do negócio** (admin). Escolha o ramo e aplique.

- Não apaga funil que já tem card. O perfil novo vira o quadro **padrão**; o antigo continua na lista.
- Locadora: Locatários + Cobrança.
- Advocacia / Facejus: Novos clientes + Processos.
- Venda do próprio CRM: Vendas SaaS.

---

## 5. Criar e publicar um agente

Criar agente novo exige **administrador**. Editar e publicar: gerente ou admin.

### Caminho curto (o wizard já criou um)

1. **Agente de IA › Agentes**.
2. Abra o agente que o primeiro acesso criou.
3. Confira as três seções (elas são abas do mesmo salvamento — um **Salvar rascunho** grava as três):
   - **Conversa com o cliente** — nome, instruções, empresa de IA, modelo, chave, **número do WhatsApp**.
   - **Organiza o sistema** — se ele mexe no funil, quais funis ele pode tocar, ferramentas.
   - **Confere antes de enviar** — o que é barrado antes de a mensagem sair.
4. **Salvar rascunho**, depois **Publicar**. Sem publicar, ele não atende ninguém.

Aba **Teste** no mesmo agente: ensaia sem mandar WhatsApp. Use isto antes do primeiro cliente.

### Caminho completo (agente novo)

1. **Agente de IA › Agentes** → criar / novo.
2. **Nome** (obrigatório).
3. **Empresa de inteligência artificial** e **modelo**.
4. **Chave de acesso** — a da instalação (se o servidor já tem) ou uma de **Credenciais**.
5. **Número conectado** — o WhatsApp em que ele fala. Sem número, não sai mensagem. Se o agente estiver num **Roteador**, este campo não se aplica: quem escolhe o canal é o roteador.
6. Instruções: como ele se apresenta, o que pode promete, o que não pode.
7. Em **Organiza o sistema**, marque os **funis** que ele pode mover. Agente sem funil no escopo conversa e **não** cria card.
8. **Criar agente** → abra de novo → **Publicar**.

### Credencial (se a instalação não trouxe chave)

**Ver tudo em IA › Credenciais** → adicionar → colar a chave → esperar a validação. “Validada” na listagem de modelos **não** basta sozinha: o produto também prova crédito com uma geração. Sem saldo, o agente “publicado” morre em toda mensagem.

### Conhecimento (PDF, política, tabela)

**Ver tudo em IA › Conhecimento**. Precisa existir um agente padrão na organização. Envie o arquivo; espere indexar. O agente consulta isto **antes** de inventar preço ou regra.

### Roteador (mais de um agente no mesmo número)

**Agente de IA › Roteadores** → **Novo roteador**. Defina qual agente pega qual conversa e quando o humano assume. Use quando um número atende dois negócios (ex.: locação e cobrança) ou dois tons.

---

## 6. Criar um fluxo de automação (Follow-up)

A automação do produto **não** é um Zapier genérico. O nome na tela é **Follow-ups**: reengajamento depois de silêncio, mudança de etapa ou pedido de ajuda do agente.

Precisa ser **gerente** ou **administrador**.

### Montar

1. **Agente de IA › Follow-ups**, aba **Fluxos**.
2. **Novo fluxo** → nome → **Criar fluxo**.
3. Abre o quadro do fluxo. Peças da paleta (só o que o motor executa):

   | Peça na paleta | Para quê |
   |---|---|
   | **Gatilho** | início. O *quando* não é nesta caixa — está nas configurações do fluxo |
   | **Aguardar** | espera fixa (minutos) ou adaptativa |
   | **Condição** | desvia se um campo bate |
   | **Classificar (IA)** | lê a última resposta e roteia (quente / frio, etc.) |
   | **Ação** | envia mensagem (texto da IA ou modelo fixo) |
   | **Fim** | encerra com um resultado (esgotou, respondeu, converteu, …) |

4. Ligue as caixas. Todo caminho precisa chegar num **Fim**.
5. No gatilho do fluxo, escolha **quando** começa — a tela só oferece o que dispara de verdade:

   | Gatilho | Quando dispara |
   |---|---|
   | **Silêncio** | ninguém falou por N minutos (mínimo 5; padrão 60) |
   | **Etapa do funil** | o card **entrou** naquela etapa daquele funil (o nome da etapa viaja **com** o funil — “Em andamento” existe em todos) |
   | **Agente pediu ajuda** | o agente abriu um caso humano |
   | **Manual** | alguém dispara na mão |

   Fim de conversa **não** é oferecido: o esquema conhece, o motor ainda não arma.

6. **Publicar**. Rascunho não corre.

### Ligar o fluxo ao agente

Abrir o **agente** → na configuração, escolher o fluxo de follow-up → salvar rascunho → **publicar o agente de novo**. Fluxo publicado e agente sem vínculo = o fluxo existe e ninguém entra nele.

### Ver se está rodando

Na mesma tela, aba **Fila**: quem está no fluxo, em que etapa, o que falhou.

Espere **poucos minutos**, não segundos. Dois relógios de ~1 min (dreno de eventos + tick do motor) precisam passar.

### Exemplo mínimo que funciona

1. Gatilho **Silêncio**, 60 minutos, cancelar se o cliente responder.
2. **Ação** — modo mensagem da IA, com um recado do tipo “retomar com educação, sem insistir se a pessoa já recusou”.
3. **Aguardar** 24 h (ou o que fizer sentido).
4. **Fim** — esgotou.
5. Publicar. Ligar ao agente. Publicar o agente.

Não coloque 1 minuto em produção “para testar”: o mínimo de silêncio na tela é 5 minutos, e o WhatsApp pune rajada.

---

## 7. Rotina do dia

| Quero… | Onde |
|---|---|
| Ver quem falou agora | Inbox |
| Ver quem esfriou | Radar |
| Responder mais rápido | Respostas rápidas, depois `/` no Inbox |
| Mover o cliente no quadro | Funis → arrastar o card |
| Ver se a IA travou | Ver tudo em IA › Execuções; Central / Alertas |
| Ver gasto do mês | Ver tudo em IA › Uso e orçamento |
| Marcar um horário | Agenda; os **tipos** (duração, quem atende) em Configurações › Tipos de agendamento |
| Convidar gente | Configurações › Equipe |
| Quem pega cliente novo | Configurações › Distribuição de atendimento |

**Assumir** uma conversa cala o automático naquela conversa. Devolver à IA: o menu da conversa (passar de volta / reativar), quando a situação já está estável.

---

## 8. Integração MOOPE (frota / Facejus)

**Canais › Integração MOOPE**, administrador.

Gera a chave que o outro sistema usa para abrir o CRM e mandar cadastro. A chave aparece **uma vez**. Eventos nos dois sentidos: o protocolo técnico está em `docs/integrations/moope/protocolo.md` — não é preciso para o atendimento do dia.

---

## 9. Super-admin da plataforma

Isto **não** é o Inbox da locadora.

1. Entre com a conta de plataforma.
2. Abra `/admin` (há atalho no menu do usuário quando o papel existe).
3. **Tenants → Novo tenant**: nome, e-mail do dono, senha inicial (≥ 8). O dono recebe o e-mail de boas-vindas se o servidor de e-mail estiver configurado; senão, entregue o e-mail e a senha na mão.
4. O dono entra em `/login` **na organização dele**, não no `/admin`.
5. Lá ele corre o wizard da seção 1 (ou você aplica o **Perfil do negócio** depois, em Configurações).

Não misture a mesa de vendas de vocês (perfil “Venda do sistema”) com o tenant do cliente. Cada locadora / escritório é uma organização.

---

## 10. Quando “não funciona”

Antes de achar que quebrou, confira nesta ordem:

1. **WhatsApp** em Conexões está conectado? Se caiu, reconecte o QR. O celular precisa ter internet.
2. O **agente** está **Publicado** (não só rascunho)? O número no agente é o mesmo da Conexão?
3. A **chave** de IA tem saldo? Abra Execuções: lá aparece a falha, não no Inbox.
4. A mensagem que você espera resposta é **nova**, ou é histórico importado? Histórico não aciona agente.
5. O follow-up está **Publicado** e **ligado ao agente**? A fila mostra inscrição? Esperou alguns minutos?
6. Você **Assumiu** a conversa? O automático está calado até devolver.
7. Papel da conta: visualizador não manda; gerente não cria agente novo; só admin conecta WhatsApp.

Se o Inbox mostra erro de atualização em loop no navegador, recarregue a página uma vez. Se voltar, é defeito de software — não “configure de novo” o WhatsApp.

---

## O que este guia não cobre de propósito

- Instalar ou atualizar o servidor (`docs/runbooks/`, `docs/SETUP.md`).
- Schema, RLS, migrations (`CLAUDE.md`).
- API REST e MCP para outro sistema (`docs/specs/11`).
- Promessas de jornada antiga (Nuvemshop obrigatória, MFA forçado no primeiro login, inbox BPO em `/admin/inbox`): isso está em docs de 2026-04 e **não** é o produto de hoje.
