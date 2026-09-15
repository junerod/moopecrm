/**
 * Porta pública do Direct para rotas e telas.
 *
 * Existe para a feature NÃO escrever o nome do transporte no import.
 */
export {
  DIRECT_CHANNEL_LABEL,
  estadoDoDirect,
  gravarSessaoDirect,
  tokenOficialDaOrg,
  validateDirectCredentials,
} from "./instagram/connect";
export type { DirectSessionState, DirectValidation } from "./instagram/connect";
