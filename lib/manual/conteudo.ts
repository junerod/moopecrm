/**
 * O texto que o operador lê em /app/manual.
 *
 * Vive aqui — e não num .md renderizado — por três razões:
 *  1. a busca e o índice precisam de id estável, resumo e vocabulário extra;
 *  2. o branding varre `lib/` e recusa nome de produto vazado;
 *  3. um markdown solto na tela vira parede de texto; bloco tipado vira passo,
 *     aviso e tabela, que é o que a pessoa procura.
 *
 * `docs/manual/` é o rascunho para quem clona o repo. Se os dois divergirem,
 * esta lista vence na tela.
 */

export type Bloco =
  | { tipo: "p"; texto: string }
  | { tipo: "aviso"; texto: string }
  | { tipo: "passos"; itens: string[] }
  | { tipo: "lista"; itens: string[] }
  | { tipo: "tabela"; cabecalho: [string, string]; linhas: Array<[string, string]> }
  | { tipo: "cards"; itens: Array<{ titulo: string; texto: string }> }
  | { tipo: "atalho"; titulo: string; href: string; cta: string };

export interface Capitulo {
  id: string;
  numero: number;
  titulo: string;
  resumo: string;
  /** Termos que a pessoa digita e o título não contém. */
  palavras: readonly string[];
  blocos: readonly Bloco[];
}

export const CAPITULOS: readonly Capitulo[] = [
  {
    id: "primeiro-acesso",
    numero: 1,
    titulo: "Como entrar pela primeira vez",
    resumo: "E-mail, senha e o passo a passo que aparece no começo.",
    palavras: ["login", "senha", "começar", "convite", "primeiro acesso"],
    blocos: [
      {
        tipo: "p",
        texto: "A entrada é e-mail e senha. A senha precisa ter pelo menos 8 caracteres. Não existe usuário sem e-mail.",
      },
      {
        tipo: "p",
        texto: "Se a organização ainda não terminou o primeiro acesso, o sistema leva ao passo a passo. A ordem — e só estes passos — é esta:",
      },
      {
        tipo: "passos",
        itens: [
          "Seu negócio — o nome e o tipo (locação, advocacia, comercial/vendas, serviços ou personalizado). Se for locação, pergunta o que a empresa aluga (veículos, máquinas, ferramentas, imóveis ou outros). Isto decide o quadro que vem depois.",
          "WhatsApp — conectar pelo QR (já vem selecionado), ou pular e conectar depois em Canais › Conexões.",
          "Quem atende — novos atendimentos ficam manuais ou entram na fila automática entre os atendentes.",
          "Organização — preview do quadro do modelo. Personalizado deixa editar o nome e as etapas. Não cria outro CRM.",
          "Lembretes — opcional: um aviso depois de 24 horas sem resposta. Quem não quiser, segue sem.",
          "Inteligência artificial — quatro jeitos (sem IA, assistente, controlada, automática). Nenhuma destas opções publica um agente sozinha.",
          "Seu time — convites. Se o e-mail da instalação não estiver configurado, a tela mostra o link para copiar; ela não finge que o convite saiu.",
        ],
      },
      {
        tipo: "p",
        texto: "No fim, Começar a usar abre a Caixa de entrada. Verificação em duas etapas não é obrigatória. Quem quiser liga em Configurações › Segurança.",
      },
      {
        tipo: "aviso",
        texto: "Convite recebido: use o link do convite. Quem ainda não tem conta escolhe “Ainda não tenho conta” nesse fluxo — não crie uma empresa nova no cadastro livre.",
      },
    ],
  },
  {
    id: "modelos-prontos",
    numero: 2,
    titulo: "Como escolher o modelo da empresa",
    resumo: "Loja, configuração e operação são três telas diferentes.",
    palavras: [
      "pack",
      "modelo",
      "modelos prontos",
      "meu modelo",
      "loja",
      "ativar",
      "saas",
      "clínica",
      "odontológica",
      "comercial",
      "advocacia",
      "locadora",
    ],
    blocos: [
      {
        tipo: "p",
        texto: "Modelo pronto não é o dia a dia. Ele só prepara a operação: assistentes, funil, pastas, respostas e rascunhos de campanha. Quem administra ativa. Quem atende trabalha nas outras telas.",
      },
      {
        tipo: "cards",
        itens: [
          {
            titulo: "Modelos prontos",
            texto: "A loja. Escolha o tipo da empresa. Se já existe um ativo, o banner de cima leva à configuração.",
          },
          {
            titulo: "Meu modelo",
            texto: "A configuração. Checklist de quatro passos e atalhos para as telas de operação.",
          },
          {
            titulo: "Operação",
            texto: "Assistentes, Funil, Conhecimento, Automações, Campanhas e Caixa de entrada — o trabalho do dia.",
          },
        ],
      },
      {
        tipo: "passos",
        itens: [
          "Abra Modelos prontos no menu.",
          "Clique em Ver modelo no card que combina com a empresa.",
          "Leia o resumo. Ativar modelo cria o que falta e não apaga o que vocês já tinham.",
          "O sistema abre Meu modelo. Conclua os quatro passos: WhatsApp, material nas pastas, publicar assistentes e ligar a primeira automação.",
          "O dia a dia não volta para a loja: Inbox, Funil e Assistentes.",
        ],
      },
      {
        tipo: "tabela",
        cabecalho: ["Modelo", "Para qual empresa"],
        linhas: [
          ["Locadora de veículos", "Aluguel, frota e cobrança no WhatsApp."],
          ["Escritório de advocacia", "Recepção, consulta, documentos e retorno — sem inventar processo."],
          ["Vendas de SaaS", "Captação, demo, proposta e sucesso do cliente."],
          ["Comercial geral", "Atenda, qualifique, envie proposta e acompanhe a venda."],
          ["Clínica médica", "Agenda, documentos, convênio e retorno do paciente."],
          ["Clínica odontológica", "Avaliação, orçamento, agenda e relacionamento."],
        ],
      },
      {
        tipo: "aviso",
        texto: "Ativar não manda mensagem para cliente. Automações nascem desligadas. Trocar de modelo instala o novo conjunto; o anterior não é apagado. Desativar fica no rodapé de Meu modelo.",
      },
      {
        tipo: "atalho",
        titulo: "Abrir a loja de modelos",
        href: "/app/modelos-prontos",
        cta: "Modelos prontos",
      },
      {
        tipo: "atalho",
        titulo: "Terminar a configuração do modelo ativo",
        href: "/app/meu-modelo",
        cta: "Meu modelo",
      },
    ],
  },
  {
    id: "whatsapp",
    numero: 3,
    titulo: "Como conectar o WhatsApp",
    resumo: "O código no celular, reconectar e o que volta sozinho para o Inbox.",
    palavras: ["qr", "conexão", "aparelho", "reconectar", "número", "whatsapp"],
    blocos: [
      { tipo: "p", texto: "Precisa ser administrador." },
      {
        tipo: "passos",
        itens: [
          "Menu Canais › Conexões.",
          "Aba Números por QR.",
          "Conectar novo WhatsApp.",
          "No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho → aponte a câmera para o QR da tela.",
          "O QR muda sozinho a cada poucos segundos. Se expirou, Gerar novo QR.",
          "Espere o estado virar conectado. Sem isto, Inbox e agente não têm canal.",
        ],
      },
      {
        tipo: "p",
        texto: "Reconectar o mesmo número: o botão de reconectar na linha. Contatos do aparelho voltam a entrar. Conversas novas ou recentes aparecem no Inbox aos poucos — cerca das últimas 48 horas, no máximo 40 fios por rodada.",
      },
      {
        tipo: "aviso",
        texto: "Conversa antiga de meses não entra sozinha no Inbox. Abra o contato e importe o histórico dali, se precisar do texto. Esse texto não liga o agente.",
      },
      {
        tipo: "p",
        texto: "Canal oficial da Meta (a outra aba) é outro caminho: credencial da Meta, não QR. Modelos oficiais só existem nesse caminho.",
      },
    ],
  },
  {
    id: "mensagens",
    numero: 4,
    titulo: "Como mandar e receber mensagem",
    resumo: "Inbox, assumir a conversa, respostas prontas e anexo.",
    palavras: ["inbox", "enviar", "composer", "assumir", "anexo", "áudio", "template"],
    blocos: [
      {
        tipo: "passos",
        itens: [
          "Atendimento › Caixa de entrada.",
          "À esquerda, a lista. Clique numa conversa.",
          "Embaixo, o campo de texto. Escreva e aperte Enter, ou o botão Enviar.",
          "Atalho A, ou o botão Assumir: você fica com a conversa e o automático cala a boca.",
          "Uma barra no começo da linha abre Respostas rápidas.",
          "O + anexa foto, vídeo, documento ou contato. Dá para gravar áudio.",
        ],
      },
      {
        tipo: "p",
        texto: "Se o cliente parou de falar há mais de um dia, o WhatsApp pode bloquear mensagem livre. O aviso acima do campo explica. Número oficial da Meta usa um modelo pronto para voltar a falar.",
      },
      {
        tipo: "aviso",
        texto: "O agente só responde mensagem nova que chega agora. Texto puxado do histórico do aparelho entra no CRM e não aciona a inteligência.",
      },
    ],
  },
  {
    id: "contatos-e-funis",
    numero: 5,
    titulo: "Como usar contatos e o quadro",
    resumo: "A lista de pessoas, as colunas do funil e o tipo do negócio.",
    palavras: ["funil", "quadro", "card", "etapas", "locadora", "advocacia", "perfil"],
    blocos: [
      {
        tipo: "p",
        texto: "CRM › Contatos. A lista enche com quem já está no aparelho, depois que o WhatsApp conecta. Para trazer a conversa antiga de uma pessoa: abra o contato e importe. Isto grava o texto; não liga o agente em cima desse passado.",
      },
      {
        tipo: "passos",
        itens: [
          "CRM › Funis — a lista dos quadros.",
          "Clique no funil (Locatários, Cobrança, Novos clientes…).",
          "Cada coluna é uma etapa. Arraste o card para mover.",
          "Clique no card para ver a pessoa, a conversa e o histórico.",
        ],
      },
      {
        tipo: "p",
        texto: "Para mudar os nomes das colunas: CRM › Etapas do funil (gerente ou administrador).",
      },
      {
        tipo: "p",
        texto: "Para trocar o tipo de negócio: Configurações › Perfil do negócio (administrador). Não apaga funil que já tem card — o perfil novo vira o quadro padrão; o antigo continua na lista.",
      },
      {
        tipo: "tabela",
        cabecalho: ["Ramo", "O que nasce"],
        linhas: [
          ["Locadora", "Locatários e Cobrança"],
          ["Escritório / Facejus", "Novos clientes e Processos"],
          ["Venda do próprio sistema", "Vendas SaaS"],
        ],
      },
    ],
  },
  {
    id: "agente",
    numero: 6,
    titulo: "Como criar o atendente automático",
    resumo: "O que ele fala, em qual número, em qual quadro, e o botão Publicar.",
    palavras: ["agente", "ia", "inteligência", "rascunho", "publicar", "credencial", "conhecimento"],
    blocos: [
      {
        tipo: "p",
        texto: "Criar agente novo exige administrador. Editar e publicar: gerente ou administrador.",
      },
      {
        tipo: "p",
        texto: "Se o primeiro acesso já criou um: Agente de IA › Agentes → abra o que nasceu. Confira as três seções — um único Salvar rascunho grava as três:",
      },
      {
        tipo: "lista",
        itens: [
          "Conversa com o cliente — nome, instruções, empresa de inteligência, modelo, chave e o número do WhatsApp.",
          "Organiza o sistema — se ele mexe no funil, quais funis pode tocar, ferramentas.",
          "Confere antes de enviar — o que é barrado antes de a mensagem sair.",
        ],
      },
      {
        tipo: "aviso",
        texto: "Sem Publicar, ele não atende ninguém. Rascunho não fala com cliente.",
      },
      {
        tipo: "p",
        texto: "Aba Teste no mesmo agente: ensaia sem mandar WhatsApp. Use isto antes do primeiro cliente.",
      },
      {
        tipo: "p",
        texto: "Agente novo do zero: Agentes → novo → nome → empresa e modelo → chave (da instalação ou de Ver tudo em IA › Credenciais) → número conectado → instruções → em Organiza o sistema, marque os funis. Agente sem funil no escopo conversa e não cria card. Criar agente → abrir de novo → Publicar.",
      },
      {
        tipo: "p",
        texto: "Se você usa Roteadores (quando um número atende dois jeitos de conversa), o número é escolhido lá, não nesta tela.",
      },
      {
        tipo: "p",
        texto: "Materiais (PDF, política, tabela): Ver tudo em IA › Conhecimento. Precisa existir um agente padrão. O agente consulta isto antes de inventar preço ou regra.",
      },
    ],
  },
  {
    id: "conhecimento",
    numero: 7,
    titulo: "Como ensinar com material da empresa",
    resumo: "As pastas do modelo e o que o assistente pode consultar.",
    palavras: ["conhecimento", "knowledge", "pdf", "pasta", "material", "ensinar", "rag"],
    blocos: [
      {
        tipo: "p",
        texto: "O modelo cria pastas vazias. Sem material da empresa, o assistente pergunta ou chama uma pessoa — não inventa preço, regra, prazo nem diagnóstico.",
      },
      {
        tipo: "passos",
        itens: [
          "Meu modelo → card Conhecimento, ou Ver tudo em IA › Conhecimento.",
          "Escolha a pasta do assunto (comercial, documentos, relacionamento…).",
          "Envie PDF, texto ou imagem com a regra real: tabela, política, horário, o que pode e o que não pode.",
          "Espere o estado ficar pronto. Material em processamento ainda não entra na resposta.",
          "Teste no assistente publicado, na aba Teste — sem mandar WhatsApp.",
        ],
      },
      {
        tipo: "aviso",
        texto: "Precisa existir um agente padrão. Histórico importado do celular não vira conhecimento sozinho. Coloque a regra na pasta.",
      },
      {
        tipo: "atalho",
        titulo: "Abrir as pastas de material",
        href: "/app/ai/knowledge/sources",
        cta: "Conhecimento",
      },
    ],
  },
  {
    id: "follow-up",
    numero: 8,
    titulo: "Como criar um fluxo que fala sozinho",
    resumo: "Quando começa, o que envia, publicar e ligar ao atendente automático.",
    palavras: ["automação", "fluxo", "follow-up", "followup", "silêncio", "fila"],
    blocos: [
      {
        tipo: "p",
        texto: "Na tela isto se chama Automações: o sistema manda mensagem sozinho depois de um silêncio, quando o card muda de coluna, ou quando o atendente automático pede ajuda. Precisa ser gerente ou administrador.",
      },
      {
        tipo: "passos",
        itens: [
          "Agente de IA › Automações.",
          "Novo fluxo → nome → Criar fluxo.",
          "Monte o quadro com as peças da paleta e ligue as caixas. Todo caminho precisa chegar num Fim.",
          "No gatilho, escolha quando começa.",
          "Publicar. Rascunho não corre.",
          "Abra o agente → escolha o fluxo → salvar rascunho → publicar o agente de novo.",
        ],
      },
      {
        tipo: "tabela",
        cabecalho: ["Peça na paleta", "Para quê"],
        linhas: [
          ["Gatilho", "Início. O quando está nas configurações do fluxo, não nesta caixa."],
          ["Aguardar", "Espera uns minutos antes do próximo passo."],
          ["Condição", "Segue por um caminho ou por outro."],
          ["Classificar (IA)", "Lê a última resposta e escolhe o caminho (quente / frio…)."],
          ["Ação", "Envia mensagem — texto da inteligência ou modelo fixo."],
          ["Fim", "Encerra com um resultado."],
        ],
      },
      {
        tipo: "tabela",
        cabecalho: ["Gatilho", "Quando dispara"],
        linhas: [
          ["Silêncio", "Ninguém falou por N minutos (mínimo 5; padrão 60)."],
          ["Etapa do funil", "O card entrou naquela coluna daquele quadro. Escolha o quadro e a coluna juntos — “Em andamento” existe em todos."],
          ["Agente pediu ajuda", "O atendente automático chamou uma pessoa."],
          ["Na mão", "Você dispara quando quiser."],
        ],
      },
      {
        tipo: "aviso",
        texto: "Não existe gatilho de “conversa encerrada”. Depois de publicar, espere alguns minutos — não é na hora.",
      },
      {
        tipo: "p",
        texto: "Para ver se está rodando: a mesma tela, aba Fila. Exemplo mínimo: Silêncio 60 minutos (cancelar se responder) → Ação com recado educado → Aguardar → Fim → publicar e ligar ao agente.",
      },
    ],
  },
  {
    id: "campanhas",
    numero: 9,
    titulo: "Como mandar uma campanha",
    resumo: "Aviso para várias pessoas no WhatsApp, sem inventar conversa nova.",
    palavras: [
      "campanha",
      "disparo",
      "promoção",
      "oferta",
      "lista",
      "público",
      "whatsapp",
      "fila",
    ],
    blocos: [
      {
        tipo: "p",
        texto:
          "Campanha é um recado comercial para várias pessoas de uma vez. Não é a conversa do dia a dia. Quem nunca falou com vocês neste WhatsApp não recebe — o sistema pede para abrir a conversa na caixa primeiro. Quem já falou neste número recebe, mesmo que o celular tenha sido reconectado.",
      },
      {
        tipo: "aviso",
        texto:
          "Precisa ser gerente ou administrador para enviar. Atendente só consulta o resultado.",
      },
      {
        tipo: "passos",
        itens: [
          "No menu, abra Campanhas. Se ainda não tem nenhuma, use Criar campanha.",
          "Objetivo — escolha o motivo (promoção, reativar quem parou, aviso, pesquisa…). Isto sugere o texto; você ainda edita.",
          "Público — quem entra na lista. Use etiqueta, tipo de pessoa (lead ou cliente), temperatura, origem, responsável ou o funil. Dá para marcar gente na mão. A tela mostra quantos serão.",
          "Conteúdo — escreva a mensagem. {{nome}} vira o nome da pessoa. Dá para anexar foto ou PDF e usar um modelo já salvo.",
          "Canal — WhatsApp, e-mail, ou os dois. No WhatsApp do celular, escolha o número que envia. Só quem já tem conversa nesse número entra de verdade.",
          "Quando — agora ou num horário. Confira o preview com um nome de exemplo.",
          "Revisar e enviar. A fila sobe sozinha, com pausa entre uma pessoa e outra para não sobrecarregar o WhatsApp.",
        ],
      },
      {
        tipo: "tabela",
        cabecalho: ["Na fila aparece", "O que significa"],
        linhas: [
          ["Enviado", "Saiu no WhatsApp (ou no e-mail)."],
          ["Respondeu", "A pessoa respondeu depois do envio."],
          ["Ignorado", "Não foi. Motivo ao lado: sem conversa neste número, bloqueado, pediu para parar…"],
          ["Falhou", "Tentou e o envio não saiu. O motivo aparece na linha."],
          ["Não saiu no WhatsApp — envio de prova", "Foi um teste. Nada chegou no celular."],
        ],
      },
      {
        tipo: "p",
        texto:
          "Depois de enviar, clique na campanha. Você vê quantos saíram, quem respondeu e o texto da resposta. Quem ficou de fora sem conversa: Caixa de entrada → Nova conversa com aquela pessoa, no número certo. Depois dispare de novo só para eles, se quiser.",
      },
      {
        tipo: "aviso",
        texto:
          "Não use campanha para falar com desconhecido neste número do celular. Abra a conversa primeiro. Campanha não cria ficha fria.",
      },
    ],
  },
  {
    id: "locadora",
    numero: 10,
    titulo: "Como preparar a locadora de veículos",
    resumo: "O modelo pronto: assistentes, quadro, textos e o que ainda precisa ligar.",
    palavras: [
      "locadora",
      "pack",
      "modelo",
      "veículos",
      "frota",
      "aluguel",
      "carro",
      "modelos prontos",
      "checklist",
      "prepare sua empresa",
    ],
    blocos: [
      {
        tipo: "p",
        texto:
          "O modelo da locadora de veículos é um conjunto pronto: seis assistentes, um quadro comercial de oito etapas, pastas de conhecimento, respostas rápidas e rascunhos de campanha. Ele não liga automação sozinha e não inventa preço, diária nem boleto.",
      },
      {
        tipo: "passos",
        itens: [
          "Administrador: Modelos prontos no menu.",
          "Ver modelo em Locadora de veículos. Leia o resumo — os seis assistentes e o quadro.",
          "Ativar modelo. O sistema cria o que falta e não apaga o que vocês já tinham.",
          "Em Meu modelo, conclua os quatro passos até 4 de 4 — Pronto para trabalhar.",
          "Conecte o WhatsApp, se ainda não conectou (capítulo Como conectar o WhatsApp).",
          "Coloque nas pastas de conhecimento as regras reais: diária, caução, documentos, o que pode e o que não pode.",
          "Abra cada assistente, confira o texto e Publicar. Sem publicar, ele não atende.",
          "Automações nascem desligadas. Ligue uma por uma, só quando o texto estiver certo.",
          "Se a gestão da frota (contratos, boleto, disponibilidade) estiver ligada em Integração MOOPE, o assistente consulta o dado oficial. Sem isso, ele pergunta ou chama uma pessoa — não chuta.",
        ],
      },
      {
        tipo: "tabela",
        cabecalho: ["Assistente", "Para quê"],
        linhas: [
          ["Atendimento da Locadora", "Recebe, entende se é cliente ou interessado e encaminha."],
          ["Consultor Comercial", "Qualifica quem quer alugar e avança o quadro."],
          ["Assistente de Disponibilidade", "Pergunta período e categoria. Só afirma vaga depois de consultar de verdade."],
          ["Assistente Financeiro", "Boleto, vencimento e atraso — só com dado da gestão."],
          ["Atendimento ao Cliente", "Quem já está com o carro: devolução, pane, multa."],
          ["Relacionamento", "Quem parou no meio ou já alugou e voltou. Não dispara campanha sozinho."],
        ],
      },
      {
        tipo: "tabela",
        cabecalho: ["Quadro comercial", "O que a coluna significa"],
        linhas: [
          ["Novo lead", "Acabou de chegar."],
          ["Em atendimento", "Alguém já falou com a pessoa."],
          ["Qualificado", "Dá para seguir: período, cidade, tipo de carro."],
          ["Cotação / Proposta", "Orçamento na mesa."],
          ["Negociação", "Ajustando valor, datas ou condições."],
          ["Reserva / Documentação", "Fechando papelada."],
          ["Fechado — Locação", "Alugou."],
          ["Perdido", "Não fechou."],
        ],
      },
      {
        tipo: "aviso",
        texto:
          "Ativar o modelo não manda mensagem para cliente. Não apaga o assistente que a empresa já tinha. Desativar desliga o modelo; o quadro e o conhecimento ficam.",
      },
      {
        tipo: "p",
        texto:
          "Empresa que já existia não precisa recomeçar o primeiro acesso. O caminho é o mesmo: Modelos prontos → Ver modelo → Ativar → Meu modelo.",
      },
      {
        tipo: "atalho",
        titulo: "Ver o modelo da locadora",
        href: "/app/modelos-prontos/locadora_veiculos",
        cta: "Abrir o modelo",
      },
    ],
  },
  {
    id: "advocacia",
    numero: 11,
    titulo: "Como preparar o escritório de advocacia",
    resumo: "Recepção, consulta, documentos e retorno — sem inventar processo.",
    palavras: [
      "advocacia",
      "escritório",
      "honorário",
      "consulta",
      "processo",
      "advogado",
    ],
    blocos: [
      {
        tipo: "p",
        texto:
          "O modelo do escritório instala seis assistentes, o quadro COMERCIAL — ESCRITÓRIO, pastas de conhecimento, respostas rápidas e rascunhos de campanha. Ele não inventa andamento, prazo, honorário nem resultado. Sem material cadastrado, pergunta ou encaminha para uma pessoa.",
      },
      {
        tipo: "passos",
        itens: [
          "Modelos prontos → Ver modelo em Escritório de advocacia → Ativar modelo.",
          "Em Meu modelo, conclua WhatsApp, material nas pastas, publicar assistentes e a primeira automação.",
          "Coloque nas pastas as áreas de atuação, a checklist documental e a tabela de honorários — só o que o escritório assume.",
          "Automações nascem desligadas. Ligue uma por uma depois de revisar o texto.",
        ],
      },
      {
        tipo: "tabela",
        cabecalho: ["Assistente", "Para quê"],
        linhas: [
          ["Atendimento do Escritório", "Recebe, identifica cliente ou novo contato e encaminha."],
          ["Novos Clientes", "Qualifica, agenda consulta e faz follow-up da proposta."],
          ["Atendimento ao Cliente", "Lado administrativo: documentos, horário, encaminhamento."],
          ["Documentos e Pendências", "Pede o que falta. Não inventa lista."],
          ["Financeiro do Escritório", "Honorário e parcela só com fonte cadastrada."],
          ["Relacionamento", "Retorno e satisfação. Não dispara campanha sozinho."],
        ],
      },
      {
        tipo: "aviso",
        texto:
          "Pergunta jurídica, prazo ou decisão: encaminhe para um advogado. O assistente não substitui análise profissional.",
      },
      {
        tipo: "atalho",
        titulo: "Ver o modelo do escritório",
        href: "/app/modelos-prontos/escritorio_advocacia",
        cta: "Abrir o modelo",
      },
    ],
  },
  {
    id: "outros-modelos",
    numero: 12,
    titulo: "SaaS, comercial e clínicas",
    resumo: "Os outros quatro modelos da loja, no mesmo jeito de ativar.",
    palavras: [
      "saas",
      "clínica",
      "odontológica",
      "comercial",
      "demo",
      "paciente",
      "orçamento",
    ],
    blocos: [
      {
        tipo: "p",
        texto:
          "Os quatro usam o mesmo caminho da locadora e do escritório: Ver modelo → Ativar → Meu modelo. Cada um nasce com seis assistentes, um funil, pastas vazias, respostas e rascunhos de campanha. Automações desligadas. Sem material, o assistente não inventa preço, diagnóstico nem prazo.",
      },
      {
        tipo: "tabela",
        cabecalho: ["Modelo", "Quadro e o que não inventa"],
        linhas: [
          ["Vendas de SaaS", "VENDAS — SaaS (contato, demo, proposta, cliente ativo). Não inventa feature, SLA nem desconto."],
          ["Comercial geral", "VENDAS — COMERCIAL (lead, proposta, fechado). Não inventa estoque, prazo de entrega nem valor."],
          ["Clínica médica", "AGENDA — CLÍNICA (contato, horário, consulta, retorno). Não diagnostica, não passa receita, não lê exame."],
          ["Clínica odontológica", "AGENDA — ODONTO (avaliação, orçamento, tratamento, alta). Não interpreta raio-x nem inventa plano de tratamento."],
        ],
      },
      {
        tipo: "aviso",
        texto:
          "Na clínica, pergunta clínica vai para uma pessoa. Valor e convênio só com tabela cadastrada nas pastas.",
      },
    ],
  },
  {
    id: "rotina",
    numero: 13,
    titulo: "O que fazer no dia a dia",
    resumo: "Onde olhar cada coisa, sem caçar no menu.",
    palavras: ["radar", "agenda", "equipe", "orçamento", "desempenho", "atalho"],
    blocos: [
      {
        tipo: "tabela",
        cabecalho: ["Quero…", "Onde"],
        linhas: [
          ["Ver quem falou agora", "Caixa de entrada"],
          ["Ver quem esfriou", "Radar"],
          ["Responder mais rápido", "Respostas rápidas, depois / na Caixa de entrada"],
          ["Mover o cliente no quadro", "Funis → arrastar o card"],
          ["Ver se a inteligência travou", "Ver tudo em IA › Execuções; Alertas"],
          ["Ver gasto do mês", "Ver tudo em IA › Uso e orçamento"],
          ["Marcar um horário", "Agenda. Os tipos ficam em Configurações › Tipos de agendamento"],
          ["Convidar gente", "Configurações › Equipe"],
          ["Quem pega cliente novo", "Configurações › Distribuição de atendimento"],
          ["Avisar vários clientes de uma vez", "Campanhas"],
          ["Preparar a locadora de veículos", "Modelos prontos → Ver modelo → Ativar → Meu modelo"],
          ["Preparar escritório, SaaS ou clínica", "Modelos prontos — o card do ramo"],
          ["Terminar a configuração do modelo", "Meu modelo"],
          ["Ler este guia de novo", "Como usar, no menu, ou o botão nas telas de modelo"],
        ],
      },
      {
        tipo: "p",
        texto: "Assumir uma conversa cala o automático nela. Devolver: o menu da conversa, quando a situação já está estável.",
      },
      {
        tipo: "p",
        texto: "A busca do sistema (⌘K no Mac, Ctrl+K no Windows) acha qualquer tela pelo nome — inclusive esta.",
      },
    ],
  },
  {
    id: "moope",
    numero: 14,
    titulo: "Como ligar a frota ou o escritório",
    resumo: "A chave que o outro sistema usa para abrir o CRM.",
    palavras: ["moope", "chave", "frota", "facejus", "integração"],
    blocos: [
      {
        tipo: "p",
        texto: "Canais › Integração MOOPE, administrador. Gera a chave que o outro sistema usa para abrir o CRM e mandar cadastro. A chave aparece uma vez. Não é preciso para o atendimento do dia.",
      },
    ],
  },
  {
    id: "plataforma",
    numero: 15,
    titulo: "Se você cuida de várias empresas",
    resumo: "Como abrir uma empresa nova para um cliente — não é o Inbox dele.",
    palavras: ["admin", "tenant", "plataforma", "organização", "várias empresas"],
    blocos: [
      {
        tipo: "aviso",
        texto: "Isto não é o Inbox do cliente. É a área de quem cuida de várias empresas no mesmo sistema.",
      },
      {
        tipo: "passos",
        itens: [
          "Entre com a conta de quem cuida da instalação.",
          "No menu da sua foto, abra Admin da plataforma.",
          "Tenants → Novo tenant: nome, e-mail do dono, senha inicial (pelo menos 8 caracteres).",
          "O dono entra pelo login normal da empresa dele — não por esse Admin.",
          "Lá ele faz o primeiro acesso, ou você escolhe o Perfil do negócio depois, em Configurações.",
        ],
      },
      {
        tipo: "p",
        texto: "Não misture a mesa de vendas de vocês com a empresa do cliente. Cada locadora ou escritório é uma empresa à parte.",
      },
    ],
  },
  {
    id: "nao-funciona",
    numero: 16,
    titulo: "Se algo não funciona",
    resumo: "O que olhar, nesta ordem, antes de achar que quebrou.",
    palavras: ["erro", "bug", "parado", "silêncio", "não responde", "falhou"],
    blocos: [
      {
        tipo: "passos",
        itens: [
          "WhatsApp em Conexões está conectado? Se caiu, reconecte o QR. O celular precisa ter internet.",
          "O agente está Publicado — não só rascunho? O número no agente é o mesmo da Conexão?",
          "A chave de inteligência tem saldo? Abra Execuções: a falha aparece lá, não no Inbox.",
          "A mensagem que você espera resposta é nova, ou é histórico importado? Histórico não aciona agente.",
          "O follow-up está Publicado e ligado ao agente? A fila mostra inscrição? Esperou alguns minutos?",
          "Você Assumiu a conversa? O automático está calado até devolver.",
          "Quem é Somente leitura não manda mensagem. Gerente não cria atendente automático novo. Só Administrador conecta o WhatsApp.",
          "Campanha: a pessoa já tem conversa neste WhatsApp? Se o motivo for “abra o fio na caixa”, abra Nova conversa e só então dispare de novo.",
          "Modelo pronto: está Ativo em Meu modelo? Os assistentes estão Publicados? A pasta de conhecimento tem as regras reais?",
        ],
      },
    ],
  },
];

export function capituloPorId(id: string): Capitulo | undefined {
  return CAPITULOS.find((c) => c.id === id);
}
