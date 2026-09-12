/**
 * Tons semânticos do design system MOOPE.
 * Cor pertence ao ícone / superfície soft — nunca ao texto inteiro.
 */
export const TONS_DS = [
  "blue",
  "cyan",
  "green",
  "amber",
  "red",
  "violet",
  "teal",
  "indigo",
] as const;

export type TomDs = (typeof TONS_DS)[number];

export const ESTILO_DO_TOM: Record<TomDs, { fg: string; bg: string }> = {
  blue: { fg: "var(--moope-primary)", bg: "var(--moope-primary-bg)" },
  cyan: { fg: "var(--moope-cyan)", bg: "color-mix(in srgb, var(--moope-cyan) 14%, transparent)" },
  green: { fg: "var(--color-success-fg)", bg: "var(--color-success-bg)" },
  amber: { fg: "var(--color-warning-fg)", bg: "var(--color-warning-bg)" },
  red: { fg: "var(--color-error-fg)", bg: "var(--color-error-bg)" },
  violet: { fg: "var(--color-ai-fg)", bg: "var(--color-ai-bg)" },
  teal: { fg: "var(--color-teal)", bg: "var(--color-teal-bg)" },
  indigo: { fg: "var(--color-indigo)", bg: "var(--color-indigo-bg)" },
};

/** Fg visível no navy da sidebar — os tons de card (fg escuro) somem no #0B1F3A. */
export const ESTILO_NAV_DO_TOM: Record<TomDs, string> = {
  blue: "var(--nav-icon-blue)",
  cyan: "var(--nav-icon-cyan)",
  green: "var(--nav-icon-green)",
  amber: "var(--nav-icon-amber)",
  red: "var(--nav-icon-red)",
  violet: "var(--nav-icon-violet)",
  teal: "var(--nav-icon-teal)",
  indigo: "var(--nav-icon-indigo)",
};

/** Tom do ícone da sidebar — a cor NÃO pinta o rótulo. */
export const TOM_DA_NAV: Record<string, TomDs> = {
  "/app/inicio": "cyan",
  "/app/inbox": "indigo",
  "/app/kanban": "amber",
  "/app/contacts": "teal",
  "/app/agenda": "amber",
  "/app/campanhas": "violet",
  "/app/radar": "indigo",
  "/app/ai/agents": "green",
  "/app/ai/followups": "cyan",
  "/app/ai/knowledge/sources": "amber",
  "/app/ai": "violet",
  "/app/connections": "teal",
  "/app/integrations/moope": "blue",
  "/app/settings/business": "teal",
  "/app/settings": "blue",
  "/app/manual": "amber",
};

export function tomDaNav(href: string): TomDs {
  if (TOM_DA_NAV[href]) return TOM_DA_NAV[href];
  const prefixo = Object.keys(TOM_DA_NAV)
    .filter((k) => href.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return prefixo ? TOM_DA_NAV[prefixo]! : "blue";
}
