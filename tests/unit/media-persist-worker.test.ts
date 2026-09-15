import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  uploadMock,
  updateEqMock,
  rpcMock,
  messageRow,
  sessoesDaOrg,
  sessionArquivo,
  sessionViva,
  consulta,
} = vi.hoisted(() => {
  function consulta(data: unknown) {
    const resultado = { data, error: null };
    const builder = {
      eq: () => builder,
      maybeSingle: async () => ({
        data: Array.isArray(data) ? (data[0] ?? null) : data,
        error: null,
      }),
      then: (resolve: (v: typeof resultado) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(resultado).then(resolve, reject),
    };
    return builder;
  }

  const sessionArquivo = {
    id: "sess-arquivo",
    status: "STOPPED",
    phone_number: "556194114879",
    provider: "waha" as const,
    waha_session_name: "org_velha",
    meta_phone_number_id: null,
    zernio_account_id: null,
    twilio_from: null,
  };

  const sessionViva = {
    id: "sess-viva",
    status: "WORKING",
    phone_number: "556194114879",
    provider: "waha" as const,
    waha_session_name: "org_viva",
    meta_phone_number_id: null,
    zernio_account_id: null,
    twilio_from: null,
  };

  return {
    uploadMock: vi.fn(),
    updateEqMock: vi.fn(),
    rpcMock: vi.fn(),
    messageRow: {
      id: "msg1",
      organization_id: "org1",
      conversation_id: "conv1",
      channel_session_id: "sess-arquivo",
      type: "image",
      media_url: "http://localhost:3030/api/files/abc.jpg",
      external_id: "false_x@lid_ABC",
      media_mime: "image/jpeg",
      media_storage_path: null as string | null,
      metadata: { raw_type: "image" },
    },
    sessionArquivo,
    sessionViva,
    sessoesDaOrg: [sessionArquivo, sessionViva] as typeof sessionArquivo[],
    consulta,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (tabela: string) => ({
      select: () =>
        tabela === "channel_sessions" ? consulta(sessoesDaOrg) : consulta(messageRow),
      update: (patch: Record<string, unknown>) => {
        updateEqMock(patch);
        return { eq: () => ({ eq: async () => ({ error: null }) }) };
      },
    }),
    storage: { from: () => ({ upload: uploadMock }) },
    rpc: rpcMock,
  }),
}));

vi.mock("@/lib/messaging/media/waha-source", () => ({
  fetchWahaMedia: vi.fn(async () => ({ buffer: Buffer.from([1, 2, 3]), mime: "image/jpeg" })),
  fetchWahaMediaDoAparelho: vi.fn(async () => {
    throw new Error("waha_media_phone_empty");
  }),
}));

import { persistMessageMedia } from "@/workers/media-persist-worker";
import { fetchWahaMedia } from "@/lib/messaging/media/waha-source";

function eventRow(attempts = 0) {
  return {
    id: "ev1",
    organization_id: "org1",
    event_type: "media.persist_requested",
    entity_kind: "message",
    entity_id: "msg1",
    payload: { message_id: "msg1" },
    metadata: {},
    consumed_by: [],
    attempts,
  };
}

describe("persistMessageMedia", () => {
  beforeEach(() => {
    uploadMock.mockReset().mockResolvedValue({ error: null });
    updateEqMock.mockReset();
    rpcMock.mockReset().mockResolvedValue({ error: null });
    messageRow.media_storage_path = null;
    messageRow.channel_session_id = "sess-arquivo";
    messageRow.type = "image";
    messageRow.media_url = "http://localhost:3030/api/files/abc.jpg";
    sessoesDaOrg.splice(0, sessoesDaOrg.length, sessionArquivo, sessionViva);
    vi.mocked(fetchWahaMedia).mockResolvedValue({
      buffer: Buffer.from([1, 2, 3]),
      mime: "image/jpeg",
    });
  });

  it("baixa pela sessão WORKING quando a da mensagem está STOPPED", async () => {
    const result = await persistMessageMedia(eventRow());
    expect(result.status).toBe("ok");
    expect(fetchWahaMedia).toHaveBeenCalledWith(
      "http://localhost:3030/api/files/abc.jpg",
      "image/jpeg",
      "org_viva",
    );
  });

  it("baixa, sobe pro bucket e atualiza a mensagem", async () => {
    const result = await persistMessageMedia(eventRow());
    expect(result.status).toBe("ok");
    expect(uploadMock).toHaveBeenCalledWith(
      "org1/conv1/msg1.jpg",
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/jpeg", upsert: true }),
    );
    expect(updateEqMock).toHaveBeenCalledWith(
      expect.objectContaining({
        media_storage_path: "org1/conv1/msg1.jpg",
        media_size_bytes: 3,
        metadata: expect.objectContaining({ media_status: "stored" }),
      }),
    );
    expect(rpcMock).toHaveBeenCalledWith(
      "emit_event",
      expect.objectContaining({ p_event_type: "media.derive_requested", p_entity_id: "msg1" }),
    );
  });

  it("pula mensagem já persistida (idempotência)", async () => {
    messageRow.media_storage_path = "org1/conv1/msg1.jpg";
    const result = await persistMessageMedia(eventRow());
    expect(result.status).toBe("skipped");
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("retorna error em falha de download com poucas tentativas, sem marcar failed", async () => {
    vi.mocked(fetchWahaMedia).mockRejectedValue(new Error("waha_media_503"));
    const result = await persistMessageMedia(eventRow(1));
    expect(result.status).toBe("error");
    expect(updateEqMock).not.toHaveBeenCalled();
  });

  it("marca failed quando o download falha na última tentativa (drain dead-letra em seguida)", async () => {
    vi.mocked(fetchWahaMedia).mockRejectedValue(new Error("waha_media_503"));
    const result = await persistMessageMedia(eventRow(4));
    expect(result.status).toBe("error");
    expect(updateEqMock).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ media_status: "failed" }) }),
    );
  });

  it("marca failed quando o upload falha na última tentativa", async () => {
    uploadMock.mockResolvedValue({ error: { message: "bucket unreachable" } });
    const result = await persistMessageMedia(eventRow(4));
    expect(result.status).toBe("error");
    expect(updateEqMock).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ media_status: "failed" }) }),
    );
  });
});
