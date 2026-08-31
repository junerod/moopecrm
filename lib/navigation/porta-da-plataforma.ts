/**
 * A porta do Admin de plataforma — fora do registro do tenant de propósito.
 *
 * `NAV_DESTINATIONS` descreve `app/app/**`. O teste de completude varre só
 * aquela raiz. `/admin` tem navegação própria (`AdminSidebar`). Sem esta
 * constante, as três superfícies do tenant (rodapé, menu do usuário, hub,
 * ⌘K) inventariam o rótulo cada uma, e uma delas esqueceria o link.
 */
export const PORTA_DA_PLATAFORMA = {
  href: "/admin",
  label: "Admin da plataforma",
  description: "Empresas clientes, impersonar um usuário e a marca do servidor.",
} as const;
