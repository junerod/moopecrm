/** O launch da locadora manda /app/contacts/{locatarios.id}, não o UUID do CRM. */

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function idPareceUuidDoContato(id: string): boolean {
  return UUID.test(id.trim());
}
