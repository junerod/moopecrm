import { beforeEach, describe, expect, it, vi } from "vitest";

const { ingestDirectInbound, ingestMetaInbound } = vi.hoisted(() => ({
  ingestDirectInbound: vi.fn(),
  ingestMetaInbound: vi.fn(),
}));

vi.mock("@/lib/channels/instagram/ingest", () => ({
  ingestDirectInbound,
}));

vi.mock("./ingest", () => ({
  ingestMetaInbound,
}));

import { processarWebhookDoAppMeta } from "./despacho";

describe("processarWebhookDoAppMeta", () => {
  beforeEach(() => {
    ingestDirectInbound.mockReset();
    ingestMetaInbound.mockReset();
  });

  it("envelope do Direct não passa pelo parser de WhatsApp", async () => {
    ingestDirectInbound.mockResolvedValue({ status: "ingested" });
    const desfechos = await processarWebhookDoAppMeta(
      {} as never,
      {
        object: "instagram",
        entry: [
          {
            id: "17841400000",
            messaging: [
              {
                sender: { id: "igsid-ana" },
                timestamp: 1_700_000_000_123,
                message: { mid: "mid.1", text: "oi" },
              },
            ],
          },
        ],
      } as never,
      { id: "sess-oficial", organizationId: "org-1", wabaId: "waba-1" },
    );
    expect(desfechos).toEqual(["ingested"]);
    expect(ingestDirectInbound).toHaveBeenCalledOnce();
    expect(ingestMetaInbound).not.toHaveBeenCalled();
  });

  it("eco do próprio envio não vira ingestão", async () => {
    const desfechos = await processarWebhookDoAppMeta(
      {} as never,
      {
        object: "instagram",
        entry: [
          {
            id: "17841400000",
            messaging: [
              {
                sender: { id: "17841400000" },
                timestamp: 1,
                message: { mid: "mid.echo", text: "ok", is_echo: true },
              },
            ],
          },
        ],
      } as never,
      { id: "sess-oficial", organizationId: "org-1", wabaId: null },
    );
    expect(desfechos).toEqual(["echo"]);
    expect(ingestDirectInbound).not.toHaveBeenCalled();
  });
});
