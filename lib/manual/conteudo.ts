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
  | { tipo: "tabela"; cabecalho: [string, string]; linhas: Array<[string, string]> };

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
    id: "whatsapp",
    numero: 2,
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
    numero: 3,
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
    numero: 4,
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
    numero: 5,
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
    id: "follow-up",
    numero: 6,
    titulo: "Como criar um fluxo que fala sozinho",
    resumo: "Quando começa, o que envia, publicar e ligar ao atendente automático.",
    palavras: ["automação", "fluxo", "follow-up", "followup", "silêncio", "fila"],
    blocos: [
      {
        tipo: "p",
        texto: "Na tela isto se chama Voltar a falar: o sistema manda mensagem sozinho depois de um silêncio, quando o card muda de coluna, ou quando o atendente automático pede ajuda. Precisa ser gerente ou administrador.",
      },
      {
        tipo: "passos",
        itens: [
          "Agente de IA › Voltar a falar, aba Fluxos.",
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
    id: "rotina",
    numero: 7,
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
    numero: 8,
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
    numero: 9,
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
    numero: 10,
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
        ],
      },
    ],
  },
];

export function capituloPorId(id: string): Capitulo | undefined {
  return CAPITULOS.find((c) => c.id === id);
}
