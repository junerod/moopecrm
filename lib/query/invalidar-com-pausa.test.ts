import { afterEach, describe, expect, it, vi } from "vitest";

import { invalidarComPausa, _resetarPausasParaTeste } from "@/lib/query/invalidar-com-pausa";

afterEach(() => {
  _resetarPausasParaTeste();
  vi.useRealTimers();
});

describe("invalidarComPausa", () => {
  it("várias chamadas na janela viram UM invalidate", () => {
    vi.useFakeTimers();
    const invalidateQueries = vi.fn();
    const qc = { invalidateQueries } as never;

    invalidarComPausa(qc, ["conversations"], 1_500);
    invalidarComPausa(qc, ["conversations"], 1_500);
    invalidarComPausa(qc, ["conversations"], 1_500);

    expect(invalidateQueries).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_499);
    expect(invalidateQueries).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(invalidateQueries).toHaveBeenCalledOnce();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["conversations"] });
  });

  it("chaves diferentes não se misturam", () => {
    vi.useFakeTimers();
    const invalidateQueries = vi.fn();
    const qc = { invalidateQueries } as never;

    invalidarComPausa(qc, ["conversations"], 1_000);
    invalidarComPausa(qc, ["messages", "c1"], 1_000);
    vi.advanceTimersByTime(1_000);

    expect(invalidateQueries).toHaveBeenCalledTimes(2);
  });
});
