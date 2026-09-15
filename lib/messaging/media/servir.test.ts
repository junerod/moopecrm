import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

const downloadMock = vi.fn();
const persistirMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ download: downloadMock }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/messaging/media/persistir", () => ({
  persistirMidiaDaMensagem: (...args: unknown[]) => persistirMock(...args),
}));

import { servirBytesDaMidia } from "@/lib/messaging/media/servir";

const msg = {
  id: "m1",
  organization_id: "org1",
  media_url: "http://localhost:3030/api/files/a.oga",
  media_mime: "audio/ogg; codecs=opus",
  media_storage_path: null as string | null,
};

describe("servirBytesDaMidia", () => {
  beforeEach(() => {
    downloadMock.mockReset();
    persistirMock.mockReset();
    msg.media_storage_path = null;
  });

  it("devolve os bytes do bucket — sem 302", async () => {
    msg.media_storage_path = "org1/conv/m1.ogg";
    downloadMock.mockResolvedValue({
      data: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/ogg" }),
      error: null,
    });

    const midia = await servirBytesDaMidia(msg);
    expect(midia?.buffer.byteLength).toBe(4);
    expect(midia?.mime).toBe("audio/ogg; codecs=opus");
    expect(persistirMock).not.toHaveBeenCalled();
  });

  it("se o bucket está vazio, persiste na hora e devolve o áudio", async () => {
    persistirMock.mockResolvedValue({
      status: "ok",
      consumer_key: "media_persist_v1",
      media: { buffer: Buffer.from([9, 8, 7]), mime: "audio/ogg; codecs=opus" },
    });

    const midia = await servirBytesDaMidia(msg);
    expect(persistirMock).toHaveBeenCalledWith({
      organizationId: "org1",
      messageId: "m1",
      attempts: 0,
    });
    expect(midia?.buffer.equals(Buffer.from([9, 8, 7]))).toBe(true);
  });

  it("sem path e sem URL: ainda persiste — histórico chega sem media_url", async () => {
    persistirMock.mockResolvedValue({
      status: "ok",
      consumer_key: "media_persist_v1",
      media: { buffer: Buffer.from([1, 2]), mime: "audio/ogg; codecs=opus" },
    });
    const midia = await servirBytesDaMidia({ ...msg, media_url: null });
    expect(persistirMock).toHaveBeenCalledWith({
      organizationId: "org1",
      messageId: "m1",
      attempts: 0,
    });
    expect(midia?.buffer.byteLength).toBe(2);
  });

  it("sem path, sem URL e persist pulou: null — a rota não inventa 502", async () => {
    persistirMock.mockResolvedValue({
      status: "skipped",
      consumer_key: "media_persist_v1",
      detail: "sem ponteiro de midia",
    });
    const midia = await servirBytesDaMidia({ ...msg, media_url: null });
    expect(midia).toBeNull();
  });

  it("a rota da inbox devolve bytes, não 302", () => {
    const rota = readFileSync("app/api/v1/messages/[id]/media/route.ts", "utf8");
    expect(rota).toMatch(/servirBytesDaMidia/);
    expect(rota).not.toMatch(/redirect\(/);
    expect(rota).toMatch(/status: 200/);
  });

  it("persistência falhou e não há bytes: null", async () => {
    persistirMock.mockResolvedValue({
      status: "error",
      consumer_key: "media_persist_v1",
      detail: "canal_media_404",
    });
    const midia = await servirBytesDaMidia(msg);
    expect(midia).toBeNull();
  });
});
