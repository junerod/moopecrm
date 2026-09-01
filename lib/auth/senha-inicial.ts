/**
 * Dono nascido pela locadora entra com senha conhecida e é obrigado a trocar.
 * A flag vive em app_metadata (só o admin API grava — o usuário não apaga sozinho).
 */
export function precisaTrocarSenhaInicial(user: {
  app_metadata?: Record<string, unknown> | null;
} | null): boolean {
  return user?.app_metadata?.must_change_password === true;
}
