import { describe, expect, it } from "vitest";

import { deveDescartarCredencial } from "./reconectar";

describe("deveDescartarCredencial", () => {
  it("force sempre descarta, mesmo com sessão saudável", () => {
    expect(deveDescartarCredencial("WORKING", true)).toBe(true);
    expect(deveDescartarCredencial("STOPPED", true)).toBe(true);
  });

  it("FAILED descarta — start suave reaproveita credencial morta", () => {
    expect(deveDescartarCredencial("FAILED", false)).toBe(true);
    expect(deveDescartarCredencial("failed", false)).toBe(true);
  });

  it.each(["STOPPED", "WORKING", "STARTING", "SCAN_QR_CODE", "", null, undefined])(
    "não descarta %s sem force — credencial no disco ainda pode valer",
    (status) => {
      expect(deveDescartarCredencial(status, false)).toBe(false);
    },
  );
});
