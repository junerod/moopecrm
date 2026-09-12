/**
 * A Inbox pergunta à matriz o que o canal PERMITE — nunca o nome do provider.
 * `requiresTemplates && !freeformOutsideWindow` é o caso em que texto livre
 * fora da janela não sai e o caminho é um modelo aprovado.
 */
import { capabilitiesOf, DEFAULT_CHANNEL_PROVIDER } from "@/lib/channels/capabilities";
import type { ChannelProvider } from "@/lib/channels/types";

export function canalExigeModeloAprovado(provider: string | null | undefined): boolean {
  const p = (provider ?? DEFAULT_CHANNEL_PROVIDER) as ChannelProvider;
  try {
    const caps = capabilitiesOf(p);
    return caps.requiresTemplates && !caps.freeformOutsideWindow;
  } catch {
    // Provider desconhecido: fail closed — não oferece picker de HSM mentiroso.
    return false;
  }
}
