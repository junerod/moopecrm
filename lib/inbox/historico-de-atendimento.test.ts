import { describe, expect, it } from "vitest";

import { formatarHoraDoAssignment, fraseDoAssignment } from "./historico-de-atendimento";

describe("fraseDoAssignment", () => {
  it("claim → assumiu", () => {
    expect(
      fraseDoAssignment({
        reason: "claim",
        from_user_name: null,
        to_user_name: "João",
        changed_by_name: "João",
      }),
    ).toBe("João assumiu");
  });

  it("transfer → transferiu para", () => {
    expect(
      fraseDoAssignment({
        reason: "transfer",
        from_user_name: "João",
        to_user_name: "Maria",
        changed_by_name: "João",
      }),
    ).toBe("João transferiu para Maria");
  });

  it("release → liberou para fila", () => {
    expect(
      fraseDoAssignment({
        reason: "release",
        from_user_name: "Maria",
        to_user_name: null,
        changed_by_name: "Maria",
      }),
    ).toBe("Maria liberou para fila");
  });
});

describe("formatarHoraDoAssignment", () => {
  it("mesmo dia: só hora", () => {
    const agora = new Date("2026-09-12T12:00:00");
    expect(formatarHoraDoAssignment("2026-09-12T09:14:00", agora)).toBe("09:14");
  });
});
