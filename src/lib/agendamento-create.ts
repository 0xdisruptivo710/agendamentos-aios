// Helpers de CRIAÇÃO de agendamento no painel (só unidades com config.criar).
// Telefone -> formato da tabela (55+DDD+número) e geração das datas recorrentes.
import { format } from "date-fns";

// Normaliza um telefone BR para o formato que a tabela usa (55 + DDD + número,
// 12-13 dígitos — igual ao que o webhook grava). Retorna null se for curto demais.
export function normalizePhoneBR(input: string): string | null {
  const digits = (input || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits; // já veio com 55
  if (digits.length === 10 || digits.length === 11) return "55" + digits; // DDD + número
  if (digits.length >= 12) return digits; // já longo o suficiente, mantém
  return null; // curto demais para ser um celular válido
}

export interface RecurrenceInput {
  startDate: string; // "yyyy-MM-dd" (input type=date)
  time: string; // "HH:mm" (input type=time)
  weekdays: number[]; // 0=Dom .. 6=Sáb
  count: number; // nº de sessões a gerar
}

// Gera as datas ("dd/MM/yyyy HH:mm") de uma recorrência: caminha dia a dia a
// partir de startDate e emite as que caem nos dias da semana escolhidos, até
// atingir `count` sessões. Horário fixo em todas (casa com "Horário Fixo" da base).
//
// `bloqueado` é opcional: quando informado, a data que ele recusar (feriado,
// almoço) é PULADA e a série continua até completar `count` — assim o paciente
// não perde sessão por causa de feriado no meio. Sem o parâmetro o
// comportamento é idêntico ao de antes, então as unidades que não usam
// bloqueio não mudam em nada.
export function generateOccurrences(
  { startDate, time, weekdays, count }: RecurrenceInput,
  bloqueado?: (dataStr: string) => boolean,
): string[] {
  const out: string[] = [];
  if (!startDate || !time || count <= 0) return out;
  const days = new Set(weekdays);
  if (days.size === 0) return out;
  const [y, m, d] = startDate.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return out;
  const cursor = new Date(y, m - 1, d, hh, mm, 0, 0);
  let guard = 0;
  while (out.length < count && guard < 366 * 3) {
    if (days.has(cursor.getDay())) {
      const s = format(cursor, "dd/MM/yyyy HH:mm");
      if (!bloqueado || !bloqueado(s)) out.push(s);
    }
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }
  return out;
}

// Data única (agendamento não-recorrente) -> ["dd/MM/yyyy HH:mm"].
export function singleOccurrence(dateStr: string, time: string): string[] {
  if (!dateStr || !time) return [];
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return [];
  return [format(new Date(y, m - 1, d, hh, mm, 0, 0), "dd/MM/yyyy HH:mm")];
}

export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 0, label: "Domingo", short: "Dom" },
  { value: 1, label: "Segunda", short: "Seg" },
  { value: 2, label: "Terça", short: "Ter" },
  { value: 3, label: "Quarta", short: "Qua" },
  { value: 4, label: "Quinta", short: "Qui" },
  { value: 5, label: "Sexta", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
];
