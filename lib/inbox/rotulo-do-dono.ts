/**
 * O que a Inbox ESCREVE sobre quem atende — uma frase só, ao lado de
 * `comandoDaConversa`. Não inventa ownership: lê o comando já calculado e o
 * viewer atual.
 *
 * SEM DONO → Fila
 * EU       → Você está atendendo
 * OUTRO    → João está atendendo
 * IA       → Automático atendendo (o estado atual, sem dono paralelo)
 */
import type { Comando } from "@/lib/inbox/comando-da-conversa";

export type ChaveDoDono = "fila" | "eu" | "outro" | "ia" | "ninguem" | "encerrada";

export interface RotuloDoDono {
  chave: ChaveDoDono;
  texto: string;
}

export function rotuloDoDono(entrada: {
  viewerUserId: string;
  comando: Comando;
}): RotuloDoDono {
  const { viewerUserId, comando } = entrada;
  if (comando.quem === "humano") {
    if (comando.userId === viewerUserId) {
      return { chave: "eu", texto: "Você está atendendo" };
    }
    const nome = comando.nome?.trim() || "Outro atendente";
    return { chave: "outro", texto: `${nome} está atendendo` };
  }
  if (comando.quem === "automatico") {
    return { chave: "ia", texto: "Automático atendendo" };
  }
  if (comando.quem === "encerrada") {
    return { chave: "encerrada", texto: "Encerrada" };
  }
  if (comando.quem === "ninguem") {
    return { chave: "ninguem", texto: "Sem atendente" };
  }
  return { chave: "fila", texto: "Fila" };
}
