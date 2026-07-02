import { format, isValid, parse, startOfDay } from "date-fns";

const SUPPORTED_FORMATS = [
  "dd/MM/yyyy HH:mm:ss",
  "dd/MM/yyyy HH:mm",
  "dd/MM/yyyy",
];

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

export function compareAgendamentoDates(a: string | null | undefined, b: string | null | undefined) {
  const aDate = parseAgendamentoDate(a);
  const bDate = parseAgendamentoDate(b);

  if (!aDate && !bDate) return 0;
  if (!aDate) return 1;
  if (!bDate) return -1;

  return aDate.getTime() - bDate.getTime();
}

export function formatAgendamentoTime(value: string | null | undefined) {
  const date = parseAgendamentoDate(value);
  return date ? format(date, "HH:mm") : "Horário indefinido";
}

export function isUpcomingAgendamento(value: string | null | undefined, baseDate = new Date()) {
  const date = parseAgendamentoDate(value);
  if (!date) return false;
  return date.getTime() >= startOfDay(baseDate).getTime();
}
