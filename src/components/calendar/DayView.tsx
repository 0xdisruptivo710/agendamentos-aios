import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { CalendarDays, Phone, User, CheckCircle, AlertCircle, Clock, Sparkles } from "lucide-react";
import type { Agendamento } from "@/hooks/useAgendamentos";
import { formatAgendamentoTime, parseAgendamentoDate } from "@/lib/agendamento-date";

interface DayViewProps {
  currentDate: Date;
  agendamentos: Agendamento[];
  onEventClick: (event: Agendamento) => void;
}

function getStatusIcon(confirmacao: string | null) {
  if (!confirmacao) return <Clock className="h-4 w-4 text-green-400" />;
  const lower = confirmacao.toLowerCase();
  if (lower.includes("confirm") || lower.includes("ok")) return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (lower.includes("cancel") || lower.includes("desmarc")) return <AlertCircle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4 text-primary" />;
}

function getStatusBorder(confirmacao: string | null) {
  if (!confirmacao) return "border-green-300/40";
  const lower = confirmacao.toLowerCase();
  if (lower.includes("confirm") || lower.includes("ok")) return "border-green-400/50";
  if (lower.includes("cancel") || lower.includes("desmarc")) return "border-destructive/50";
  return "border-primary/40";
}

export function DayView({ currentDate, agendamentos, onEventClick }: DayViewProps) {
  const dayEvents = agendamentos.filter((a) => {
    const parsed = parseAgendamentoDate(a.Data);
    return parsed ? isSameDay(parsed, currentDate) : false;
  });

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
          {dayEvents.map((event, i) => (
            <motion.button
              key={event.id}
              type="button"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onEventClick(event)}
              className={`glass-card w-full rounded-2xl border p-4 text-left transition-all hover:bg-secondary/60 ${getStatusBorder(event.Confirmação)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-green-400" />
                    <span className="text-sm font-bold text-foreground">{event.Nome || "Sem nome"}</span>
                  </div>
                  <p className="mb-2 text-xs font-semibold text-primary">{formatAgendamentoTime(event.Data)}</p>
                  {event["Número"] && (
                    <div className="mb-1 flex items-center gap-2">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{event["Número"]}</span>
                    </div>
                  )}
                  {event.Procedimento && (
                    <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-green-400/15 px-2 py-0.5 text-[10px] font-semibold text-green-500">
                      <Sparkles className="h-3 w-3" />
                      <span>{event.Procedimento}</span>
                    </div>
                  )}
                  {event.Anotações && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{event.Anotações}</p>}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  {getStatusIcon(event.Confirmação)}
                  <span>{event.Confirmação || "Pendente"}</span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
