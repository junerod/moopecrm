/**
 * Envio humano pelo Inbox assume o atendimento de forma DURÁVEL.
 *
 * Antes: janela deslizante de 5 minutos. O cliente falava de novo e a IA
 * voltava. Agora: `bot_silenced_until = infinity` + claim se não houver dono.
 * A IA só volta com Devolver para automação.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sendMessageHandler } from "@/app/api/v1/messages/_handler";
import type { HandlerCtx } from "@/lib/api/handlers/types";
import type { SendMessageInput } from "@/lib/schemas";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ storage: { from: () => ({ createSignedUrl: vi.fn() }) } }),
}));
vi.mock("@/lib/audit", () => ({
  audit: vi.fn(async () => {}),
  isServiceRoleConfigured: () => false,
}));

const ORG = "11111111-1111-4111-8111-111111111111";
const CONV = "22222222-2222-4222-8222-222222222222";
const CONTACT = "33333333-3333-4333-8333-333333333333";
const SESSION = "44444444-4444-4444-8444-444444444444";
const USER = "55555555-5555-4555-8555-555555555555";
const AGENT_RUN = "66666666-6666-4666-8666-666666666666";

type Row = Record<string, unknown>;

function conversationRow(over: { botSilencedUntil?: string | null; assignedTo?: string | null } = {}): Row {
  return {
    id: CONV,
    organization_id: ORG,
    contact_id: CONTACT,
    channel_session_id: SESSION,
    is_group: false,
    group_chat_id: null,
    assigned_to_user_id: over.assignedTo ?? null,
    bot_silenced_until: over.botSilencedUntil ?? null,
    contacts: { phone_number: "+5531999998888", wa_identity: null, is_blocked: false },
    channel_sessions: { provider: "waha", waha_session_name: "default", status: "WORKING" },
  };
}

function makeSupabase(over: { botSilencedUntil?: string | null; assignedTo?: string | null } = {}) {
  const patches: Row[] = [];
  const rpcs: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    from(table: string) {
      if (table === "conversations") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: conversationRow(over), error: null }),
            }),
          }),
          update: (patch: Row) => {
            patches.push(patch);
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      if (table === "messages") {
        return {
          insert: (row: Row) => {
            const nova = { id: "msg-1", external_id: null, ack: null, error_code: null, error_message: null, ...row };
            return { select: () => ({ single: async () => ({ data: nova, error: null }) }) };
          },
          update: (patch: Row) => ({
            eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: { id: "msg-1", ...patch }, error: null }) }) }),
          }),
        };
      }
      if (table === "contacts") {
        const cadeiaContacts: Record<string, unknown> = {
          eq: () => cadeiaContacts,
          then: (resolve: (v: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve),
        };
        return { update: () => cadeiaContacts };
      }
      throw new Error(`fake_supabase: tabela inesperada '${table}'`);
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcs.push({ fn, args });
      return { data: [{ id: CONV }], error: null };
    },
  };
  return { supabase: client as unknown as SupabaseClient, patches, rpcs };
}

const input = { conversation_id: CONV, type: "text", body: "oi" } as SendMessageInput;

function wahaConfigured() {
  vi.stubEnv("WAHA_API_BASE_URL", "http://localhost:3030");
  vi.stubEnv("WAHA_API_KEY", "hash123");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ id: { id: "BARE1" } }), { status: 200 })),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sendMessageHandler — envio humano assume de forma durável", () => {
  it("humano manda mensagem → bot_silenced_until vira infinity (não 5 min)", async () => {
    wahaConfigured();
    const ctx: HandlerCtx = { organization_id: ORG, actor: { type: "user", id: USER }, requestId: "req-1" };
    const { supabase, patches } = makeSupabase();

    await sendMessageHandler(supabase, ctx, input);

    const comSilencio = patches.filter((p) => p.bot_silenced_until !== undefined);
    expect(comSilencio.length, "não silenciou a IA após resposta manual").toBeGreaterThan(0);
    for (const p of comSilencio) {
      expect(p.bot_silenced_until).toBe("infinity");
    }
  });

  it("TESTE C: silêncio finito legado (30 min) é promovido a infinity — não volta sozinho", async () => {
    wahaConfigured();
    const ctx: HandlerCtx = { organization_id: ORG, actor: { type: "user", id: USER }, requestId: "req-4" };
    const trintaMin = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { supabase, patches } = makeSupabase({ botSilencedUntil: trintaMin, assignedTo: USER });

    await sendMessageHandler(supabase, ctx, input);

    const ultimo = patches[patches.length - 1]!;
    expect(ultimo.bot_silenced_until).toBe("infinity");
  });

  it("TESTE D: conversa sem dono → claim + silêncio durável", async () => {
    wahaConfigured();
    const ctx: HandlerCtx = { organization_id: ORG, actor: { type: "user", id: USER }, requestId: "req-d" };
    const { supabase, patches, rpcs } = makeSupabase({ assignedTo: null });

    await sendMessageHandler(supabase, ctx, input);

    const claim = rpcs.find((r) => r.fn === "fn_conversation_assign");
    expect(claim, "envio humano sem dono não reclamou a conversa").toBeDefined();
    expect(claim!.args).toMatchObject({
      p_organization_id: ORG,
      p_conversation_id: CONV,
      p_to_user_id: USER,
      p_reason: "claim",
    });
    expect(patches.some((p) => p.bot_silenced_until === "infinity")).toBe(true);
  });

  it("IA envia mensagem (ai_agent) → NÃO mexe em bot_silenced_until nem reclama", async () => {
    wahaConfigured();
    const ctx: HandlerCtx = {
      organization_id: ORG,
      actor: { type: "ai_agent", id: AGENT_RUN, role: "agent" },
      requestId: "req-2",
    };
    const { supabase, patches, rpcs } = makeSupabase();

    await sendMessageHandler(supabase, ctx, input);

    const convPatch = patches[patches.length - 1]!;
    expect(convPatch.bot_silenced_until, "a IA silenciou a si mesma ao responder").toBeUndefined();
    expect(rpcs.filter((r) => r.fn === "fn_conversation_assign")).toEqual([]);
  });

  it("handoff permanente já ativo → resposta manual reafirma infinity, nunca encurta", async () => {
    wahaConfigured();
    const ctx: HandlerCtx = { organization_id: ORG, actor: { type: "user", id: USER }, requestId: "req-3" };
    const { supabase, patches } = makeSupabase({ botSilencedUntil: "infinity", assignedTo: USER });

    await sendMessageHandler(supabase, ctx, input);

    for (const p of patches.filter((x) => x.bot_silenced_until !== undefined)) {
      expect(p.bot_silenced_until).toBe("infinity");
    }
  });
});
