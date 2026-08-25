// Helpers da EDIÇÃO de data/horário de um agendamento (config.editarData).
// Cada sessão é uma linha na tabela; "editar a recorrência" = mover também as
// sessões futuras do mesmo paciente que caem no mesmo dia da semana e horário.
import { format } from "date-fns";
import type { Agendamento } from "@/hooks/useAgendamentos";

// "yyyy-MM-dd" + "HH:mm" -> "dd/MM/yyyy HH:mm" (formato texto da tabela).
// Retorna null se alguma parte for inválida.
export function buildDataString(dateStr: string, time: string): string | null {
  if (!dateStr || !time) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return null;
  return format(new Date(y, m - 1, d, hh, mm, 0, 0), "dd/MM/yyyy HH:mm");
}

function normName(s: string | null | undefined): string {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

// Mesmo paciente: pelo telefone quando ambos têm; senão pelo nome normalizado.
export function samePatient(a: Agendamento, b: Agendamento): boolean {
  const telA = (a["Número"] ?? "").replace(/\D/g, "");
  const telB = (b["Número"] ?? "").replace(/\D/g, "");
  if (telA && telB) return telA === telB;
  const nomeA = normName(a.Nome);
  const nomeB = normName(b.Nome);
  return !!nomeA && nomeA === nomeB;
}

// Sessões FUTURAS da mesma recorrência: mesmo paciente, data posterior à da
// sessão aberta, mesmo dia da semana e mesmo horário dela. É esse conjunto que
// o checkbox "aplicar às sessões futuras" move junto.
export function findFutureSiblings(event: Agendamento, agendamentos: Agendamento[]): Agendamento[] {
  const base = event.parsedDate;
  if (!base) return [];
  const dow = base.getDay();
  const hm = format(base, "HH:mm");
  return agendamentos.filter(
    (a) =>
      a.id !== event.id &&
      a.parsedDate &&
      a.parsedDate.getTime() > base.getTime() &&
      a.parsedDate.getDay() === dow &&
      format(a.parsedDate, "HH:mm") === hm &&
      samePatient(a, event),
  );
}

// TODAS as sessões futuras do paciente (Data > now), em qualquer dia da semana
// e horário — inclusive a própria sessão aberta, se ainda for futura. Alvo do
// botão "Excluir todos os futuros deste paciente" (config.excluirFuturos).
export function sessoesFuturasDoPaciente(
  event: Agendamento,
  agendamentos: Agendamento[],
  now: Date = new Date(),
): Agendamento[] {
  return agendamentos.filter(
    (a) => a.parsedDate && a.parsedDate.getTime() > now.getTime() && samePatient(a, event),
  );
}

// Move uma sessão futura pelo mesmo deslocamento aplicado à sessão editada:
// weekdayDelta em dias (ex.: terça -> quarta = +1) dentro da própria semana da
// sessão, e o novo horário fixo. Retorna a nova string de Data.
export function shiftSessao(sessao: Agendamento, weekdayDelta: number, time: string): string | null {
  if (!sessao.parsedDate) return null;
  const [hh, mm] = time.split(":").map(Number);
  if ([hh, mm].some((n) => Number.isNaN(n))) return null;
  const d = new Date(sessao.parsedDate.getTime());
  d.setDate(d.getDate() + weekdayDelta);
  d.setHours(hh, mm, 0, 0);
  return format(d, "dd/MM/yyyy HH:mm");
}
