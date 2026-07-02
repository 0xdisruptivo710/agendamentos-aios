import { startOfWeek, endOfWeek, eachDayOfInterval, format, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import type { Agendamento } from "@/hooks/useAgendamentos";
import { formatAgendamentoTime, parseAgendamentoDate } from "@/lib/agendamento-date";

interface WeekViewProps {
  currentDate: Date;
  agendamentos: Agendamento[];
  onEventClick: (event: Agendamento) => void;
}

function getConfirmationStyle(confirmacao: string | null) {
  if (!confirmacao) return "border-green-300/30 bg-secondary";
  const lower = confirmacao.toLowerCase();
  if (lower.includes("confirm") || lower.includes("ok")) return "border-green-400/50 bg-green-400/10";
  if (lower.includes("cancel") || lower.includes("desmarc")) return "border-destructive/50 bg-destructive/10";
  if (lower.includes("reagend")) return "border-green-300/50 bg-green-300/10";
  return "border-green-300/40 bg-green-300/10";
}

export function WeekView({ currentDate, agendamentos, onEventClick }: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { locale: ptBR });
  const weekEnd = endOfWeek(currentDate, { locale: ptBR });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getEventsForDay = (day: Date) =>
    agendamentos.filter((a) => {
      const parsed = parseAgendamentoDate(a.Data);
      return parsed ? isSameDay(parsed, day) : false;
    });

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-7">
      {days.map((day, i) => {
        const events = getEventsForDay(day);
        const today = isToday(day);

        return (
          <motion.div
            key={day.toISOString()}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`glass-card min-h-[260px] rounded-2xl p-3 ${today ? "ring-1 ring-primary/40" : ""}`}
          >
            <div className="mb-3 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {format(day, "EEE", { locale: ptBR })}
              </div>
              <div className={`mx-auto mt-1 flex h-9 w-9 items-center justify-center rounded-full text-lg font-extrabold ${
                today ? "bg-primary text-primary-foreground" : "text-foreground"
              }`}>
                {format(day, "d")}
              </div>
            </div>

            <div className="space-y-2">
              {events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onEventClick(event)}
                  className={`w-full rounded-xl border p-2.5 text-left transition-all hover:brightness-95 ${getConfirmationStyle(event.Confirmação)}`}
                >
                  <p className="text-[11px] font-bold text-primary">{formatAgendamentoTime(event.Data)}</p>
                  <p className="mt-1 text-xs font-semibold text-foreground line-clamp-2">{event.Nome || "Sem nome"}</p>
                  {event["Número"] && <p className="mt-1 truncate text-[10px] text-muted-foreground">{event["Número"]}</p>}
                </button>
              ))}
              {events.length === 0 && <p className="pt-4 text-center text-[10px] text-muted-foreground/50">Sem agendamentos</p>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
