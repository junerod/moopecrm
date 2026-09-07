import { describe, expect, it, vi } from "vitest";

import type { EventRow } from "@/lib/event-log/dispatcher";
import {
  applyReactivityEvent,
  type LiveEnrollmentRef,
  type ReactivityAdminClient,
} from "@/lib/followup/reactivity";
import type { EnrollmentPatch } from "@/lib/followup/engine";

function row(partial: Partial<EventRow>): EventRow {
  return {
    id: "evt-1",
    organization_id: "org-1",
    event_type: "lead.won",
    entity_kind: "crm_lead",
    entity_id: "lead-1",
    payload: {},
    metadata: {},
    consumed_by: [],
    attempts: 0,
    ...partial,
  };
}

function dbFake(enrollments: LiveEnrollmentRef[]) {
  const updates: Array<{ id: string; patch: EnrollmentPatch }> = [];
  const client: ReactivityAdminClient = {
    loadConversationContactId: async () => null,
    loadLeadContactId: async () => "contact-1",
    loadContactBlocked: async () => false,
    loadLiveEnrollmentsForContact: async () => enrollments,
    insertEnrollmentEvent: async () => ({ inserted: true }),
    updateEnrollment: async (id, _org, patch) => {
      updates.push({ id, patch });
    },
    agoraNoBanco: async () => new Date().toISOString(),
  };
  return { client, updates };
}

const vivo: LiveEnrollmentRef = {
  id: "enr-1",
  status: "active",
  current_node_id: "t1",
  steps_taken: 0,
  pointer_id: "ptr-1",
  handoff_policy: "pause",
  trigger_config: { kind: "silence", params: { threshold_minutes: 1440 }, cancel_on_reply: true },
};

describe("follow-up cancela quando o negócio fecha", () => {
  it("lead.won cancela com converted/lead_won", async () => {
    const { client, updates } = dbFake([vivo]);
    const s = await applyReactivityEvent(client, () => new Date("2026-09-07T12:00:00Z"), row({}));
    expect(s.matched).toBe(true);
    expect(s.reacted).toBe(1);
    expect(updates[0]?.patch.status).toBe("cancelled");
    expect(updates[0]?.patch.outcome).toBe("converted");
    expect(updates[0]?.patch.cancel_reason).toBe("lead_won");
  });

  it("lead.lost cancela com exhausted/lead_lost — sem if de segmento", async () => {
    const { client, updates } = dbFake([{ ...vivo, id: "enr-2" }]);
    const s = await applyReactivityEvent(
      client,
      () => new Date("2026-09-07T12:00:00Z"),
      row({ event_type: "lead.lost" }),
    );
    expect(s.reacted).toBe(1);
    expect(updates[0]?.patch.outcome).toBe("exhausted");
    expect(updates[0]?.patch.cancel_reason).toBe("lead_lost");
  });

  it("sem contact_id no payload ainda resolve pelo lead", async () => {
    const load = vi.fn(async () => "contact-1");
    const { client } = dbFake([vivo]);
    client.loadLeadContactId = load;
    await applyReactivityEvent(client, () => new Date(), row({ payload: {} }));
    expect(load).toHaveBeenCalledWith("org-1", "lead-1");
  });
});
