import { redirect } from "next/navigation";

import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";

export default async function AppHome() {
  const user = await loadAuthUser();
  if (!user) redirect("/login");
  const org = await resolveActiveOrg(user);
  if (!org && user.is_platform_admin) redirect("/admin/dashboard");
  redirect("/app/inbox");
}
