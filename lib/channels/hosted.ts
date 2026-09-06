/**
 * Porta do canal por credencial hospedada — a rota e a tela não nomeiam
 * o provedor. Implementação em `./twilio/connect`.
 */
export {
  HOSTED_CHANNEL_LABEL,
  HOSTED_CHANNEL_PROVIDER,
  findHostedSession,
  saveHostedSession,
  validateHostedCredentials,
} from "./twilio/connect";
export type { HostedCredentialsInput, HostedSession, HostedValidation } from "./twilio/connect";
export { twilioDigits as hostedFromDigits } from "./twilio/credentials";
