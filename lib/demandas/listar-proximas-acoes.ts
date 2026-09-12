import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ehAcaoDeHoje,
  estadoDaProximaAcao,
  rotuloDoAtraso,
  rotuloDoQuando,
} from "@/lib/comercial/proxima-acao";

export type VisaoDaAcao = "hoje" | "proximos" | "atrasados" | "sem_passo" | "todas";

export interface ProximaAcaoLinha {
  demanda_id: string;
  contact_id: string;
  lead_id: string | null;
  conversation_id: string | null;
  texto: string | null;
  em: string | null;
  dono_user_id: string | null;
  contact_name: string;
  lead_title: string | null;
  temperatura: "frio" | "morno" | "quente" | null;
  estado: ReturnType<typeof estadoDaProximaAcao>;
  atraso: string | null;
  quando: string | null;
}

export async function listarProximasAcoes(
  sb: SupabaseClient,
  args: {
    organizationId: string;
    visao: VisaoDaAcao;
    ownerUserId?: string | null;
    agora?: Date;
  },
): Promise<ProximaAcaoLinha[]> {
  const agora = args.agora ?? new Date();
  let q = sb
    .from("demandas")
    .select("id, contact_id, lead_id, proximo_passo, proximo_passo_em, dono_user_id")
    .eq("organization_id", args.organizationId)
    .is("fechada_em", null)
    .order("proximo_passo_em", { ascending: true, nullsFirst: false })
    .limit(200);

  if (args.ownerUserId) q = q.eq("dono_user_id", args.ownerUserId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const ids = (data ?? []).map((r) => r.id as string);
  const contactIds = [...new Set((data ?? []).map((r) => r.contact_id as string))];
  const leadIds = [...new Set((data ?? []).map((r) => r.lead_id as string | null).filter((x): x is string => !!x))];

  const [{ data: vinculos }, { data: contatos }, { data: leads }] = await Promise.all([
    ids.length === 0
      ? Promise.resolve({ data: [] as Array<{ demanda_id: string; conversation_id: string }> })
      : sb
          .from("demanda_conversas")
          .select("demanda_id, conversation_id")
          .eq("organization_id", args.organizationId)
          .in("demanda_id", ids),
    contactIds.length === 0
      ? Promise.resolve({ data: [] as Array<{ id: string; display_name: string | null }> })
      : sb
          .from("contacts")
          .select("id, display_name")
          .eq("organization_id", args.organizationId)
          .in("id", contactIds),
    leadIds.length === 0
      ? Promise.resolve({
          data: [] as Array<{
            id: string;
            title: string | null;
            temperatura: "frio" | "morno" | "quente" | null;
          }>,
        })
      : sb
          .from("crm_leads")
          .select("id, title, temperatura")
          .eq("organization_id", args.organizationId)
          .in("id", leadIds),
  ]);

  const convPorDemanda = new Map<string, string>();
  for (const v of vinculos ?? []) {
    if (!convPorDemanda.has(v.demanda_id as string)) {
      convPorDemanda.set(v.demanda_id as string, v.conversation_id as string);
    }
  }
  const nomePorContato = new Map(
    (contatos ?? []).map((c) => [c.id as string, (c.display_name as string | null)?.trim() || "Contato"]),
  );
  const leadPorId = new Map(
    (leads ?? []).map((l) => [
      l.id as string,
      {
        title: (l.title as string | null) ?? null,
        temperatura: (l.temperatura as "frio" | "morno" | "quente" | null) ?? null,
      },
    ]),
  );

  const linhas: ProximaAcaoLinha[] = [];
  for (const r of data ?? []) {
    const texto = (r.proximo_passo as string | null) ?? null;
    const em = (r.proximo_passo_em as string | null) ?? null;
    const estado = estadoDaProximaAcao({ texto, em }, agora);
    const lead = r.lead_id ? leadPorId.get(r.lead_id as string) : undefined;
    const linha: ProximaAcaoLinha = {
      demanda_id: r.id as string,
      contact_id: r.contact_id as string,
      lead_id: (r.lead_id as string | null) ?? null,
      conversation_id: convPorDemanda.get(r.id as string) ?? null,
      texto,
      em,
      dono_user_id: (r.dono_user_id as string | null) ?? null,
      contact_name: nomePorContato.get(r.contact_id as string) ?? "Contato",
      lead_title: lead?.title ?? null,
      temperatura: lead?.temperatura ?? null,
      estado,
      atraso: rotuloDoAtraso(em, agora),
      quando: rotuloDoQuando(em, agora),
    };

    if (args.visao === "hoje" && !ehAcaoDeHoje(em, agora)) continue;
    if (args.visao === "proximos" && (estado !== "aberta" || ehAcaoDeHoje(em, agora))) continue;
    if (args.visao === "atrasados" && estado !== "atrasada") continue;
    if (args.visao === "sem_passo" && estado !== "sem") continue;
    linhas.push(linha);
  }
  return linhas;
}
