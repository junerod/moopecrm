/**
 * O handler de envio é o último lugar em que um MCP/webhook pode burlar
 * o comando. Estes casos exercitam sendMessageHandler de verdade.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sendMessageHandler } from "@/app/api/v1/messages/_handler";
import type { ApiError } from "@/lib/api/types";
import type { HandlerCtx } from "@/lib/api/handlers/types";
import type { SendMessageInput } from "@/lib/schemas";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ createSignedUrl: vi.fn() }) },
    from: () => ({
      update: () => ({
        eq: () => ({
          eq: () => ({
            in: () => ({ select: async () => ({ data: [], error: null }) }),
            select: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/audit", () => ({
  audit: vi.fn(async () => {}),
  isServiceRoleConfigured: () => false,
}));

const ORG = "11111111-1111-4111-8111-111111111111";
const CONV = "22222222-2222-4222-8222-222222222222";
const CONTACT = "33333333-3333-4333-8333-333333333333";
const SESSION = "44444444-4444-4444-8444-444444444444";

function conversationRow(over: {
  silenced?: boolean;
  assignedTo?: string | null;
  forceHuman?: boolean;
} = {}) {
  return {
    id: CONV,
    organization_id: ORG,
    contact_id: CONTACT,
    channel_session_id: SESSION,
    is_group: false,
    group_chat_id: null,
    status: "claimed",
    assigned_to_user_id: over.assignedTo ?? "55555555-5555-4555-8555-555555555555",
    assignee_kind: "user",
    bot_silenced_until: over.silenced === false ? null : "infinity",
    contacts: {
      phone_number: "+5531999998888",
      wa_identity: null,
      is_blocked: false,
      force_human: over.forceHuman ?? false,
    },
    channel_sessions: { provider: "waha", waha_session_name: "default", status: "WORKING" },
  };
}

function makeSupabase(row = conversationRow()) {
  const client = {
    from(table: string) {
      if (table === "conversations") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: row, error: null }),
            }),
          }),
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      if (table === "messages") {
        return {
          insert: (r: Record<string, unknown>) => ({
            select: () => ({
              single: async () => ({
                data: { id: "msg-1", external_id: null, ack: null, error_code: null, error_message: null, ...r },
                error: null,
              }),
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: () => ({
              select: () => ({ maybeSingle: async () => ({ data: { id: "msg-1", ...patch }, error: null }) }),
            }),
          }),
        };
      }
      if (table === "contacts") {
        const chain: Record<string, unknown> = {
          eq: () => chain,
          then: (resolve: (v: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve),
        };
        return { update: () => chain };
      }
      throw new Error(`fake: ${table}`);
    },
    rpc: async () => ({ data: [{ id: CONV }], error: null }),
  };
  return client as unknown as SupabaseClient;
}

const input = { conversation_id: CONV, type: "text", body: "boleto" } as SendMessageInput;

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

describe("TESTE 13 — envio operacional MOOPE com humano no comando", () => {
  it("send_intent=operational_moope passa do predicado e chega ao canal", async () => {
    wahaConfigured();
    const ctx: HandlerCtx = {
      organization_id: ORG,
      actor: { type: "webhook_source", id: "moope-send" },
      requestId: "req-moope",
      send_intent: "operational_moope",
    };
    const msg = await sendMessageHandler(makeSupabase(), ctx, input);
    expect(msg.id).toBe("msg-1");
  });
});

describe("TESTE 14 — MCP com humano no comando é DENY", () => {
  it("integration_api + silêncio durável → state_conflict", async () => {
    const ctx: HandlerCtx = {
      organization_id: ORG,
      actor: { type: "ai_agent", id: "run-1", role: "agent" },
      requestId: "req-mcp",
      send_intent: "integration_api",
    };
    await expect(sendMessageHandler(makeSupabase(), ctx, input)).rejects.toMatchObject({
      status: 409,
      code: "state_conflict",
    } satisfies Partial<ApiError>);
  });
});

describe("TESTE 15 — webhook genérico não herda MOOPE", () => {
  it("webhook_source sem send_intent + humano no comando → DENY", async () => {
    const ctx: HandlerCtx = {
      organization_id: ORG,
      actor: { type: "webhook_source", id: "regra-qualquer" },
      requestId: "req-wh",
    };
    await expect(sendMessageHandler(makeSupabase(), ctx, input)).rejects.toMatchObject({
      status: 409,
      code: "state_conflict",
    });
  });
});
