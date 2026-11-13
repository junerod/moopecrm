import { describe, expect, it } from "vitest";

import { markConversationUnreadHandler } from "@/app/api/v1/conversations/_handler";
import { ApiError } from "@/lib/api/types";

const ORG = "11111111-1111-4111-8111-111111111111";
const CONV = "22222222-2222-4222-8222-222222222222";

describe("markConversationUnreadHandler", () => {
  it("volta o contador para 1 e filtra o tenant", async () => {
    const filtros: Record<string, string> = {};
    let patch: Record<string, unknown> | null = null;
    const db = {
      from(tabela: string) {
        expect(tabela).toBe("conversations");
        return {
          update(p: Record<string, unknown>) {
            patch = p;
            return this;
          },
          eq(col: string, val: string) {
            filtros[col] = val;
            return this;
          },
          select() {
            return this;
          },
          maybeSingle: async () => ({
            data: { id: CONV, organization_id: ORG, unread_count_for_assignee: 1 },
            error: null,
          }),
        };
      },
    };
    const conv = await markConversationUnreadHandler(
      db as never,
      { organization_id: ORG, actor: { type: "user", id: "u1" }, requestId: "r1" },
      CONV,
    );
    expect(patch).toEqual({ unread_count_for_assignee: 1 });
    expect(filtros.id).toBe(CONV);
    expect(filtros.organization_id).toBe(ORG);
    expect(conv.unread_count_for_assignee).toBe(1);
  });

  it("404 se a conversa não é deste tenant", async () => {
    const db = {
      from() {
        return {
          update() {
            return this;
          },
          eq() {
            return this;
          },
          select() {
            return this;
          },
          maybeSingle: async () => ({ data: null, error: null }),
        };
      },
    };
    await expect(
      markConversationUnreadHandler(
        db as never,
        { organization_id: ORG, actor: { type: "user", id: "u1" }, requestId: "r1" },
        CONV,
      ),
    ).rejects.toMatchObject({ status: 404 } satisfies Partial<ApiError>);
  });
});
