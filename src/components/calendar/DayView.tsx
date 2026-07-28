import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { CalendarDays, Phone, User, CheckCircle, AlertCircle, Clock, Sparkles, Building2 } from "lucide-react";
import type { Agendamento } from "@/hooks/useAgendamentos";
import { dayKeyFromDate, formatAgendamentoTime } from "@/lib/agendamento-date";
import { deriveStatus, TONE_BORDER, type StatusTone } from "@/lib/agendamento-status";
import { corDoProfissional } from "@/lib/profissional-cores";
import { useUnit } from "@/context/UnitContext";

interface DayViewProps {
  currentDate: Date;
  agendamentos: Agendamento[];
  onEventClick: (event: Agendamento) => void;
}

const TONE_ICON: Record<StatusTone, { Icon: typeof Clock; className: string }> = {
  success: { Icon: CheckCircle, className: "text-green-500" },
  danger: { Icon: AlertCircle, className: "text-destructive" },
  warning: { Icon: AlertCircle, className: "text-amber-500" },
  primary: { Icon: Clock, className: "text-primary" },
  muted: { Icon: Clock, className: "text-primary" },
};

export function DayView({ currentDate, agendamentos, onEventClick }: DayViewProps) {
  const cores = useUnit().config?.cores;
  const dayEvents = useMemo(() => {
    const key = dayKeyFromDate(currentDate);
    return agendamentos.filter((a) => a.dayKey === key);
  }, [agendamentos, currentDate]);

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {format(currentDate, "EEEE", { locale: ptBR })}
        </p>
        <p className="mt-1 text-4xl font-extrabold text-foreground">{format(currentDate, "dd")}</p>
        <p className="text-sm text-muted-foreground">{format(currentDate, "MMMM yyyy", { locale: ptBR })}</p>
      </div>

      {dayEvents.length === 0 ? (
        <div className="py-16 text-center">
          <CalendarDays className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">Nenhum agendamento neste dia</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dayEvents.map((event, i) => {
            const status = deriveStatus(event);
            const { Icon: StatusIcon, className: statusIconClass } = TONE_ICON[status.tone];
            const prof = corDoProfissional(cores, event.Responsavel_Atendimento);
            return (
            <motion.button
              key={event.id}
              type="button"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onEventClick(event)}
              className={`glass-card w-full rounded-2xl border p-4 text-left transition-all hover:bg-secondary/60 ${TONE_BORDER[status.tone]}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-green-400" />
                    <span className="text-sm font-bold text-foreground">{event.Nome || "Sem nome"}</span>
                  </div>
                  <p className="mb-2 text-xs font-semibold text-primary">{formatAgendamentoTime(event.parsedDate)}</p>
                  {event["Número"] && (
                    <div className="mb-1 flex items-center gap-2">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{event["Número"]}</span>
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {prof && (
                      <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${prof.chip}`}>
                        <span className={`h-2 w-2 rounded-full ${prof.dot}`} />
                        <span>{prof.key}</span>
                      </div>
                    )}
                    {event.Procedimento && (
                      <div className="inline-flex items-center gap-1 rounded-full bg-green-400/15 px-2 py-0.5 text-[10px] font-semibold text-green-500">
                        <Sparkles className="h-3 w-3" />
                        <span>{event.Procedimento}</span>
                      </div>
                    )}
                    {event.Origem && (
                      <div className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        <span>{event.Origem}</span>
                      </div>
                    )}
                  </div>
                  {event.Anotações && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{event.Anotações}</p>}
                </div>
                <div className={`flex items-center gap-2 text-[10px] ${statusIconClass}`}>
                  <StatusIcon className={`h-4 w-4 ${statusIconClass}`} />
                  <span>{status.label}</span>
                </div>
              </div>
            </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
