import type { createAdminClient } from "@/lib/supabase/admin";

import { mesmoTelefone, type ConsultaCrm } from "./comando";
import { lerAssessorNasSettings } from "./config";

type Admin = ReturnType<typeof createAdminClient>;

export type LinhaDoPainel = { title: string; detail?: string; tone?: "ok" | "warn" | "muted" };

export type PainelCrm = {
  kind: "geral";
  title: string;
  subtitle?: string;
  kpis: { label: string; value: string; tone?: "ok" | "warn" | "muted" }[];
  bars: [];
  rows: LinhaDoPainel[];
  rowsTitle: string;
  alerts: [];
  note: string;
};

export type ResultadoConsulta = {
  text: string;
  board: PainelCrm;
};

function inicioDoDiaSp(agora = new Date()): Date {
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  return new Date(`${hoje}T00:00:00-03:00`);
}

function horaSp(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

async function orgsDoTelefone(admin: Admin, phone: string) {
  const { data, error } = await admin.from("organizations").select("id, display_name, settings");
  if (error) throw new Error(error.message);
  return (data ?? []).filter((org) => mesmoTelefone(lerAssessorNasSettings(org.settings).phone, phone));
}

async function nomes(admin: Admin, organizationId: string, ids: string[]) {
  const unicos = [...new Set(ids.filter(Boolean))].slice(0, 40);
  if (!unicos.length) return new Map<string, { nome: string; fone: string }>();
  const { data } = await admin
    .from("contacts")
    .select("id, display_name, name, phone_number")
    .eq("organization_id", organizationId)
    .in("id", unicos);
  const mapa = new Map<string, { nome: string; fone: string }>();
  for (const c of data ?? []) {
    mapa.set(c.id, {
      nome: c.display_name || c.name || "Lead",
      fone: c.phone_number || "",
    });
  }
  return mapa;
}

export async function consultarCrm(
  admin: Admin,
  phone: string,
  consulta: ConsultaCrm,
): Promise<ResultadoConsulta | null> {
  const orgs = await orgsDoTelefone(admin, phone);
  if (!orgs.length) return null;

  const inicio = inicioDoDiaSp();
  const desde =
    consulta === "semana" ? new Date(inicio.getTime() - 6 * 24 * 60 * 60 * 1000) : inicio;
  const linhas: LinhaDoPainel[] = [];
  let total = 0;

  for (const org of orgs) {
    if (consulta === "respostas") {
      const { data: msgs } = await admin
        .from("messages")
        .select("contact_id, body, created_at")
        .eq("organization_id", org.id)
        .eq("direction", "inbound")
        .gte("created_at", inicio.toISOString())
        .order("created_at", { ascending: false })
        .limit(40);
      const vistos = new Set<string>();
      const ids = (msgs ?? []).map((m) => m.contact_id).filter(Boolean);
      const mapa = await nomes(admin, org.id, ids);
      for (const m of msgs ?? []) {
        if (!m.contact_id || vistos.has(m.contact_id)) continue;
        vistos.add(m.contact_id);
        const quem = mapa.get(m.contact_id);
        const trecho = (m.body || "").replace(/\s+/g, " ").trim().slice(0, 80);
        linhas.push({
          title: quem?.nome || "Lead",
          detail: [horaSp(m.created_at), quem?.fone, trecho].filter(Boolean).join(" · "),
          tone: "warn",
        });
        if (linhas.length >= 12) break;
      }
      total += vistos.size;
      continue;
    }

    const base = admin
      .from("crm_leads")
      .select("id, title, status, created_at, contact_id")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false })
      .limit(20);
    const { data: leads } =
      consulta === "abertos"
        ? await base.eq("status", "open")
        : await base.gte("created_at", desde.toISOString());
    const mapa = await nomes(
      admin,
      org.id,
      (leads ?? []).map((l) => l.contact_id || ""),
    );
    total += (leads ?? []).length;
    for (const lead of (leads ?? []).slice(0, 12)) {
      const quem = lead.contact_id ? mapa.get(lead.contact_id) : undefined;
      linhas.push({
        title: quem?.nome || lead.title,
        detail: [horaSp(lead.created_at), lead.status === "open" ? "aberto" : lead.status, quem?.fone]
          .filter(Boolean)
          .join(" · "),
        tone: lead.status === "open" ? "ok" : "muted",
      });
    }
  }

  const titulos: Record<ConsultaCrm, string> = {
    dia: "Leads de hoje",
    semana: "Leads da semana",
    abertos: "Leads abertos",
    respostas: "Quem falou hoje",
  };
  const titulo = titulos[consulta];
  const orgNome = orgs.length === 1 ? orgs[0]?.display_name || "CRM" : "CRM";
  const mostrados = linhas.slice(0, 12);
  const text = [
    `📋 *${titulo}*`,
    `_${orgNome}_`,
    total ? `${total} no recorte.` : "Nada nesse recorte.",
    ...mostrados.slice(0, 5).map((l) => `• *${l.title}*${l.detail ? ` — ${l.detail}` : ""}`),
    total > 5 ? "O restante está no painel." : null,
  ]
    .filter((l): l is string => Boolean(l))
    .join("\n");

  return {
    text,
    board: {
      kind: "geral",
      title: titulo,
      subtitle: orgNome,
      kpis: [{ label: "No recorte", value: String(total), tone: total ? "ok" : "muted" }],
      bars: [],
      rows: mostrados,
      rowsTitle: titulo,
      alerts: [],
      note: "Link só desta consulta. Vale 24 horas.",
    },
  };
}
