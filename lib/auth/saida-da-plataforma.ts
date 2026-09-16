/**
 * Para onde o dono do servidor vai quando pede o CRM pessoal.
 *
 * Login sem empresa ainda cai no admin (`destinoAposLogin`). Este destino é
 * o contrário: a pessoa pediu para SAIR da plataforma. Mandar de volta ao
 * dashboard é o laço que trava a sessão.
 */
export const HREF_DO_APP_PESSOAL = "/app/inicio";
export const HREF_SEM_EMPRESA = "/admin/sem-empresa";

export function destinoDoAppPessoal(temOrganizacao: boolean): string {
  return temOrganizacao ? HREF_DO_APP_PESSOAL : HREF_SEM_EMPRESA;
}
