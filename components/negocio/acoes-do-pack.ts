export async function instalarPack(packId: string): Promise<boolean> {
  const res = await fetch("/api/v1/business-packs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pack_id: packId }),
  });
  return res.ok;
}

export async function mudarEstadoDoPack(action: "activate" | "deactivate"): Promise<boolean> {
  const res = await fetch("/api/v1/business-packs", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  return res.ok;
}
