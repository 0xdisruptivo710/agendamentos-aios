// Uma frase dizendo QUEM respondeu o comparecimento: o paciente (pelo bot) ou a
// recepção (à mão). Era o pedido do dono da clínica em 19/11/2026 — a
// recepcionista conferia presença no sistema da clínica porque a agenda não
// dizia de onde vinha a informação, nem se alguém já tinha perguntado.
//
// Fica fora do componente para ter teste: é a frase em que a clínica vai
// confiar para parar de checar em dois lugares.
import { format, isValid } from "date-fns";

export interface ComparecimentoInput {
  Presenca?: string | null;
  Comparecimento_Perguntado_Em?: string | null;
  Comparecimento_Resposta?: string | null;
  Comparecimento_Respondido_Em?: string | null;
  parsedDate?: Date | null;
}

export type ComparecimentoTom = "success" | "warning" | "muted";

export interface ComparecimentoInfo {
  texto: string;
  tom: ComparecimentoTom;
  // true = o PACIENTE respondeu (fato), false = veio da recepção ou ninguém
  doPaciente: boolean;
}

// "2026-11-19T19:00:27.84-03:00" -> "19/11 às 19:00". null se não der para ler.
function quando(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(String(iso).replace(" ", "T"));
  return isValid(d) ? format(d, "dd/MM 'às' HH:mm") : null;
}

export function descreveComparecimento(
  event: ComparecimentoInput,
  now: Date = new Date(),
): ComparecimentoInfo {
  const presenca = (event.Presenca ?? "").trim();
  const resposta = (event.Comparecimento_Resposta ?? "").trim().toLowerCase();
  const perguntadoEm = quando(event.Comparecimento_Perguntado_Em);
  const respondidoEm = quando(event.Comparecimento_Respondido_Em);

  if (presenca && resposta) {
    const oQue = resposta.startsWith("s") ? "que foi atendido" : "que não conseguiu ir";
    return {
      texto: `O próprio paciente respondeu ${oQue}${respondidoEm ? ` em ${respondidoEm}` : ""}.`,
      tom: "success",
      doPaciente: true,
    };
  }
  if (presenca) {
    return {
      texto: "Registrado pela recepção" + (perguntadoEm ? ` (o bot perguntou em ${perguntadoEm}).` : "."),
      tom: "muted",
      doPaciente: false,
    };
  }
  if (perguntadoEm) {
    return {
      texto: `O bot perguntou em ${perguntadoEm} e o paciente ainda não respondeu. Marque abaixo para fechar na mão.`,
      tom: "warning",
      doPaciente: false,
    };
  }
  const d = event.parsedDate;
  const jaPassou = !!d && now.getTime() - d.getTime() >= 60 * 60 * 1000;
  return {
    texto: jaPassou
      ? "A consulta já passou e o bot não chegou a perguntar. Marque abaixo."
      : "O bot pergunta ao paciente cerca de 1h depois da consulta.",
    tom: jaPassou ? "warning" : "muted",
    doPaciente: false,
  };
}
