import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./ingest", () => ({
  ingestDirectInbound: vi.fn(),
}));

import { ingestDirectInbound } from "./ingest";
import {
  inscreverWebhookDoDirect,
  mensagensDoDirectDaGraph,
  receberDirectAposAutorizar,
} from "./receber";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("mensagensDoDirectDaGraph", () => {
  it("ignora eco da própria conta e guarda o inbound", () => {
    const eventos = mensagensDoDirectDaGraph(
      {
        data: [
          {
            messages: {
              data: [
                {
                  id: "mid.eco",
                  created_time: "2026-09-15T20:57:00.000Z",
                  from: { id: "17841437595958148", username: "moopetec" },
                  message: "resposta",
                },
                {
                  id: "mid.cli",
                  created_time: "2026-09-15T20:57:10.000Z",
                  from: { id: "ig-ana", username: "ana" },
                  message: "tem o que pra vender?",
                },
              ],
            },
          },
        ],
      },
      "17841437595958148",
    );
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      from: "ig-ana",
      username: "ana",
      externalId: "mid.cli",
      text: "tem o que pra vender?",
    });
  });

  it("lista vazia — não inventa evento", () => {
    expect(mensagensDoDirectDaGraph({ data: [] }, "1")).toEqual([]);
  });
});

describe("inscreverWebhookDoDirect", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("POST subscribed_apps na Graph do Instagram", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    const r = await inscreverWebhookDoDirect({
      token: "tok",
      accountId: "17841437595958148",
    });
    expect(r).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("graph.instagram.com"),
      expect.objectContaining({ method: "POST" }),
    );
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/17841437595958148/subscribed_apps");
  });
});

describe("receberDirectAposAutorizar", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.mocked(ingestDirectInbound).mockReset();
  });

  it("inscreve e ingere o que a Graph devolveu", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              messages: {
                data: [
                  {
                    id: "mid.1",
                    created_time: "2026-09-15T20:57:00.000Z",
                    from: { id: "ig-ana", username: "ana" },
                    message: "oi",
                  },
                ],
              },
            },
          ],
        }),
      });
    vi.mocked(ingestDirectInbound).mockResolvedValue({
      status: "ingested",
      messageId: "m1",
      conversationId: "c1",
    });

    const r = await receberDirectAposAutorizar({} as never, {
      organizationId: "org-1",
      accountId: "acc-1",
      token: "tok",
    });
    expect(r).toEqual({ subscribed: true, imported: 1 });
    expect(ingestDirectInbound).toHaveBeenCalledTimes(1);
  });
});
