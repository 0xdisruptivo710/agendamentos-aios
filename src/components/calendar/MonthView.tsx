import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import type { Agendamento } from "@/hooks/useAgendamentos";
import { formatAgendamentoTime, parseAgendamentoDate } from "@/lib/agendamento-date";

interface MonthViewProps {
  currentDate: Date;
  agendamentos: Agendamento[];
  onEventClick: (event: Agendamento) => void;
  onDayClick: (date: Date) => void;
}

function getConfirmationColor(confirmacao: string | null) {
  if (!confirmacao) return "bg-muted text-foreground";
  const lower = confirmacao.toLowerCase();
  if (lower.includes("confirm") || lower.includes("ok")) return "bg-primary/12 text-primary";
  if (lower.includes("cancel") || lower.includes("desmarc")) return "bg-destructive/10 text-destructive";
  return "bg-secondary text-primary";
}

export function MonthView({ currentDate, agendamentos, onEventClick, onDayClick }: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { locale: ptBR });
  const calEnd = endOfWeek(monthEnd, { locale: ptBR });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const getEventsForDay = (day: Date) =>
    agendamentos.filter((a) => {
      const eventDate = parseAgendamentoDate(a.Data);
      return eventDate ? isSameDay(eventDate, day) : false;
    });

  return (
    <div className="glass-card overflow-hidden rounded-2xl">
      <div className="grid grid-cols-7 border-b border-border">
        {weekDays.map((d) => (
          <div key={d} className="py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const events = getEventsForDay(day);
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);

          return (
            <motion.div
              key={day.toISOString()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.004 }}
              onClick={() => onDayClick(day)}
              className={`min-h-[120px] border-b border-r border-border/50 p-2 transition-all cursor-pointer hover:bg-secondary/50 ${
                inMonth ? "opacity-100" : "opacity-35"
              } ${today ? "bg-primary/5" : ""}`}
            >
              <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                today ? "bg-primary text-primary-foreground" : "text-foreground/80"
              }`}>
                {format(day, "d")}
              </div>

              <div className="space-y-1.5">
                {events.slice(0, 3).map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    className={`w-full rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold leading-tight transition-all hover:brightness-95 ${getConfirmationColor(event.Confirmação)}`}
                  >
                    <span className="block">{formatAgendamentoTime(event.Data)}</span>
                    <span className="mt-0.5 block truncate">{event.Nome || "Sem nome"}</span>
                  </button>
                ))}
                {events.length > 3 && (
                  <span className="pl-1 text-[10px] font-semibold text-primary">+{events.length - 3} agendamentos</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
