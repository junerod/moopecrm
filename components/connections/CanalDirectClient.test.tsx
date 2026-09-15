import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CanalDirectClient } from "./CanalDirectClient";

describe("CanalDirectClient", () => {
  it("mostra a porta do Direct sem oferecer conectar", () => {
    render(<CanalDirectClient />);
    expect(screen.getByTestId("canal-direct")).toBeInTheDocument();
    expect(screen.getByTestId("direct-proximo-passo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /conectar/i })).toBeNull();
  });
});
