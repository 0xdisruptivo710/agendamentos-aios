import { format, isValid, parse, startOfDay } from "date-fns";

const SUPPORTED_FORMATS = [
  "dd/MM/yyyy HH:mm:ss",
  "dd/MM/yyyy HH:mm",
  "dd/MM/yyyy",
];

// Parse é CARO (date-fns tenta até 3 formatos + fallback). Deve rodar UMA vez
// por linha, no fetch (useAgendamentos.fromRow) — nunca dentro de render/filter.
// Componentes consomem `parsedDate`/`dayKey` já computados no shape canônico.
export function parseAgendamentoDate(value: string | null | undefined): Date | null {
  if (!value) return null;

  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase().includes("invalid")) return null;

  for (const dateFormat of SUPPORTED_FORMATS) {
    const parsed = parse(normalized, dateFormat, new Date());
    if (isValid(parsed)) return parsed;
  }

  const fallback = new Date(normalized);
  return isValid(fallback) ? fallback : null;
}

// Chave de agrupamento por dia ("yyyy-MM-dd", timezone local) — mesmo formato
// que <input type="date"> produz, então dá pra comparar direto com state de filtro.
export function dayKeyFromDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

// Índice dia -> agendamentos, para os calendários fazerem lookup O(1) por célula
// em vez de filtrar (e re-parsear) a lista inteira 42x por render.
export function buildDayIndex<T extends { dayKey: string | null }>(items: T[]): Map<string, T[]> {
  const index = new Map<string, T[]>();
  for (const item of items) {
    if (!item.dayKey) continue;
    const bucket = index.get(item.dayKey);
    if (bucket) bucket.push(item);
    else index.set(item.dayKey, [item]);
  }
  return index;
}

export function formatAgendamentoTime(date: Date | null | undefined) {
  return date ? format(date, "HH:mm") : "Horário indefinido";
}

export function isUpcomingAgendamento(date: Date | null | undefined, baseDate = new Date()) {
  if (!date) return false;
  return date.getTime() >= startOfDay(baseDate).getTime();
}
