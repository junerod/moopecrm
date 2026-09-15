import type { ActiveOrg, UserOrgMembership } from "./types";

/**
 * Qual organização vale neste pedido.
 *
 * Impersonate ganha de membership: o admin de plataforma entra na empresa do
 * cliente sem precisar ser membro dela. Sem o cookie, vale o cookie
 * `active_org` se a pessoa for membro; senão a primeira membership.
 */
export function escolherOrgAtiva(args: {
  memberships: UserOrgMembership[];
  cookieOrg?: string | null;
  impersonate?: { tenantId: string; name: string } | null;
}): ActiveOrg | null {
  if (args.impersonate) {
    return {
      orgId: args.impersonate.tenantId,
      name: args.impersonate.name,
      role: "admin",
    };
  }
  if (args.cookieOrg) {
    const found = args.memberships.find(
      (o) => o.organization_id === args.cookieOrg,
    );
    if (found) {
      return {
        orgId: found.organization_id,
        name: found.organization_name,
        role: found.role,
      };
    }
  }
  const first = args.memberships[0];
  if (!first) return null;
  return {
    orgId: first.organization_id,
    name: first.organization_name,
    role: first.role,
  };
}
