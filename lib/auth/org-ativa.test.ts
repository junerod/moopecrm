import { describe, expect, it } from "vitest";

import { escolherOrgAtiva } from "./org-ativa";
import type { UserOrgMembership } from "./types";

const moope: UserOrgMembership = {
  organization_id: "org-moope",
  organization_name: "MOOPE Tecnologia",
  role: "admin",
};

const jk: UserOrgMembership = {
  organization_id: "org-jk",
  organization_name: "JK Auto",
  role: "agent",
};

describe("escolherOrgAtiva", () => {
  it("sem membership e sem impersonate — ninguém para operar", () => {
    expect(escolherOrgAtiva({ memberships: [] })).toBeNull();
  });

  it("impersonate ganha da membership — suporte entra no cliente, não na casa", () => {
    const ativa = escolherOrgAtiva({
      memberships: [moope],
      cookieOrg: "org-moope",
      impersonate: { tenantId: "org-solutt", name: "SOLUTT" },
    });
    expect(ativa).toEqual({
      orgId: "org-solutt",
      name: "SOLUTT",
      role: "admin",
    });
  });

  it("impersonate funciona sem membership — admin da instalação não precisa ser da empresa", () => {
    const ativa = escolherOrgAtiva({
      memberships: [],
      impersonate: { tenantId: "org-jk", name: "JK Auto" },
    });
    expect(ativa).toEqual({
      orgId: "org-jk",
      name: "JK Auto",
      role: "admin",
    });
  });

  it("cookie só vale se a pessoa for membro daquela org", () => {
    const ativa = escolherOrgAtiva({
      memberships: [moope, jk],
      cookieOrg: "org-jk",
    });
    expect(ativa?.orgId).toBe("org-jk");
    expect(ativa?.role).toBe("agent");
  });

  it("cookie de org alheia cai na primeira membership", () => {
    const ativa = escolherOrgAtiva({
      memberships: [moope],
      cookieOrg: "org-fantasma",
    });
    expect(ativa?.orgId).toBe("org-moope");
  });
});
