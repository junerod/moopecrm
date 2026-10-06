/**
 * Qual chave entra sozinha quando o assistente ainda não escolheu uma.
 *
 * A instalação (chave no ambiente) vence: é o padrão de quem instalou e não
 * quer repetir a escolha em cada assistente. Sem ela, uma única chave validada
 * daquele provedor também entra. Duas ou mais continuam pedindo escolha —
 * adivinhar entre elas gravaria a conta errada.
 */

export interface CredencialParaPadrao {
  id: string;
  provider: string;
  is_active: boolean;
  validated_at: string | null;
  validation_error: string | null;
}

export function escolherCredencialPadrao(input: {
  provider: string;
  instalacaoTemChave: boolean;
  credenciais: CredencialParaPadrao[];
  tokenDaInstalacao: string;
}): string {
  if (input.instalacaoTemChave) return input.tokenDaInstalacao;
  const validas = input.credenciais.filter(
    (c) =>
      c.provider === input.provider &&
      c.is_active &&
      c.validated_at != null &&
      !c.validation_error,
  );
  if (validas.length === 1) return validas[0]!.id;
  return "";
}
