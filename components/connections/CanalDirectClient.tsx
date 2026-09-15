import { ProximoPasso } from "@/components/ds/ProximoPasso";

/**
 * Porta do Direct na mesma Inbox — sem botão que mente.
 *
 * A conversa já carrega o canal. O que falta é o transporte. Oferecer
 * "Conectar" aqui abriria um OAuth que esta instalação ainda não tem, e o
 * operador acharia que o Direct já recebe. O próximo passo é o WhatsApp
 * continuar no ar; o Direct entra nesta aba quando o adapter nascer.
 */
export function CanalDirectClient() {
  return (
    <div className="space-y-4" data-testid="canal-direct">
      <div>
        <h2 className="text-base font-semibold">Direct</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          A mesma Inbox, outro canal. A conversa do cliente entra aqui do lado do
          WhatsApp — sem fila separada e sem app paralelo. Ainda não conecta:
          ligar agora seria prometer mensagem que não chega.
        </p>
      </div>
      <ProximoPasso
        testId="direct-proximo-passo"
        titulo="WhatsApp já atende nesta Inbox"
        texto="O Direct usa o mesmo lugar. Enquanto ele não conecta, o atendimento continua no número que já está no ar."
        acao="Ver conversas"
        href="/app/inbox"
      />
    </div>
  );
}
