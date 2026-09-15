import { CAPITULOS } from "@/lib/manual/conteudo";
import { NAV_DESTINATIONS } from "@/lib/navigation/registry";

export const PARAM_AJUDA = "ajuda";
export const CHAVE_TELA_ANTES = "tela-antes-do-manual";

export function ehCapituloDoManual(id: string | null | undefined): id is string {
  return Boolean(id && CAPITULOS.some((c) => c.id === id));
}

export function hrefComAjuda(pathname: string, search: string, capitulo: string): string {
  const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  p.set(PARAM_AJUDA, capitulo);
  const q = p.toString();
  return q ? `${pathname}?${q}` : pathname;
}

export function hrefSemAjuda(pathname: string, search: string): string {
  const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  p.delete(PARAM_AJUDA);
  const q = p.toString();
  return q ? `${pathname}?${q}` : pathname;
}

export function capituloSugerido(pathname: string): string {
  if (pathname.startsWith("/app/modelos-prontos") || pathname.startsWith("/app/meu-modelo")) {
    return "modelos-prontos";
  }
  if (pathname.startsWith("/app/campanhas")) return "campanhas";
  if (pathname.startsWith("/app/inbox")) return "mensagens";
  if (pathname.startsWith("/app/connections")) return "whatsapp";
  if (pathname.startsWith("/app/ai/knowledge")) return "conhecimento";
  if (pathname.startsWith("/app/ai/agents")) return "agente";
  if (pathname.startsWith("/app/ai/followups")) return "follow-up";
  if (pathname.startsWith("/app/kanban") || pathname.startsWith("/app/contacts")) {
    return "contatos-e-funis";
  }
  return "primeiro-acesso";
}

export function rotuloDaTela(pathname: string): string {
  const exato = NAV_DESTINATIONS.find((d) => d.href === pathname);
  if (exato) return exato.label;
  const prefixo = NAV_DESTINATIONS.filter(
    (d) => pathname === d.href || pathname.startsWith(`${d.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0];
  return prefixo?.label ?? "tela anterior";
}

export function lembrarTela(pathname: string, search: string) {
  if (typeof window === "undefined") return;
  if (pathname === "/app/manual") return;
  window.sessionStorage.setItem(CHAVE_TELA_ANTES, hrefSemAjuda(pathname, search));
}

export function telaAntesDoManual(): string | null {
  if (typeof window === "undefined") return null;
  const v = window.sessionStorage.getItem(CHAVE_TELA_ANTES);
  return v && v !== "/app/manual" ? v : null;
}
