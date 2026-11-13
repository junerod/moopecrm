/** Abrir a conversa marca como lida — a menos que a pessoa acabou de pedir o contrário. */
export function deveAgendarLeitura(unread: number, pausado: boolean): boolean {
  return unread > 0 && !pausado;
}
