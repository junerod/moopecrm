/**
 * Depois do magiclink do launch, o CRM NÃO pode 302 direto para /app.
 *
 * O clique vem de outro domínio (locadora). O cookie de sessão é
 * SameSite=Strict. O Chrome trata a cadeia de redirects como cross-site e
 * não manda o cookie no /app — a aba cai no login com a sessão já criada
 * no banco. Uma página HTML neste domínio que navega em seguida quebra
 * a cadeia: o próximo GET é first-party e o Strict vai.
 */
import { caminhoDoLaunchEhSeguro } from "@/lib/moope/tipos";

export const CAMINHO_PADRAO_DO_LAUNCH = "/app/inbox";

export function destinoDoLaunch(path: string): string {
  return caminhoDoLaunchEhSeguro(path) ? path : CAMINHO_PADRAO_DO_LAUNCH;
}

export function htmlParaContinuarLaunch(path: string): string {
  const dest = destinoDoLaunch(path);
  const js = JSON.stringify(dest);
  const href = dest
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "")
    .replace(/>/g, "");
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${href}">
<title>Entrando</title>
</head>
<body>
<p>Abrindo o atendimento…</p>
<script>location.replace(${js})</script>
</body>
</html>`;
}
