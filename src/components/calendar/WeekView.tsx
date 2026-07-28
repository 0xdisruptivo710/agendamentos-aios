import { useMemo } from "react";
import { startOfWeek, endOfWeek, eachDayOfInterval, format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import type { Agendamento } from "@/hooks/useAgendamentos";
import { buildDayIndex, dayKeyFromDate, formatAgendamentoTime } from "@/lib/agendamento-date";
import { deriveStatus, type StatusTone } from "@/lib/agendamento-status";
import { corDoProfissional } from "@/lib/profissional-cores";
import { useUnit } from "@/context/UnitContext";

interface WeekViewProps {
  currentDate: Date;
  agendamentos: Agendamento[];
  onEventClick: (event: Agendamento) => void;
}

const TONE_STYLE: Record<StatusTone, string> = {
  success: "border-green-400/50 bg-green-400/10",
  danger: "border-destructive/50 bg-destructive/10",
  warning: "border-amber-400/50 bg-amber-400/10",
  primary: "border-primary/40 bg-primary/10",
  // Pendente = roxo da marca (antes cinza/secondary).
  muted: "border-primary/40 bg-primary/10",
};

export function WeekView({ currentDate, agendamentos, onEventClick }: WeekViewProps) {
  const cores = useUnit().config?.cores;
  const weekStart = startOfWeek(currentDate, { locale: ptBR });
  const weekEnd = endOfWeek(currentDate, { locale: ptBR });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Lookup O(1) por dia via índice memoizado (parse já feito no fetch).
  const eventsByDay = useMemo(() => buildDayIndex(agendamentos), [agendamentos]);
  const getEventsForDay = (day: Date) => eventsByDay.get(dayKeyFromDate(day)) ?? [];

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
              {events.map((event) => {
                const prof = corDoProfissional(cores, event.Responsavel_Atendimento);
                return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onEventClick(event)}
                  className={`w-full rounded-xl border p-2.5 text-left transition-all hover:brightness-95 ${TONE_STYLE[deriveStatus(event).tone]}`}
                >
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-primary">
                    {prof && <span className={`h-2 w-2 shrink-0 rounded-full ${prof.dot}`} title={prof.key} />}
                    {formatAgendamentoTime(event.parsedDate)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-foreground line-clamp-2">{event.Nome || "Sem nome"}</p>
                  {event["Número"] && <p className="mt-1 truncate text-[10px] text-muted-foreground">{event["Número"]}</p>}
                </button>
                );
              })}
              {events.length === 0 && <p className="pt-4 text-center text-[10px] text-muted-foreground/50">Sem agendamentos</p>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
