// Fila de trabalho do comparecimento: as consultas que JÁ PASSARAM e continuam
// sem presença registrada — na prática, as que o bot perguntou e o paciente não
// respondeu (60 de 166 em 14 dias na OdontoCompany, medido em 20/11/2026).
//
// É o que faltava para a agenda fechar sozinha: em vez de abrir uma ficha por
// vez, a recepção vê a lista e resolve cada linha com um clique. Só aparece nas
// unidades com config.comparecimento.
import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { ClipboardCheck, MessageCircleQuestion, UserRound } from "lucide-react";
import type { Agendamento } from "@/hooks/useAgendamentos";
import { PresencaRapida, pendentesDePresenca, DIAS_PENDENTES } from "@/components/calendar/PresencaRapida";

interface PresencasPendentesPanelProps {
  agendamentos: Agendamento[];
  onEventClick: (event: Agendamento) => void;
}

const DIAS = DIAS_PENDENTES;
const MAX = 12;

export function PresencasPendentesPanel({ agendamentos, onEventClick }: PresencasPendentesPanelProps) {
  const pendentes = useMemo(() => pendentesDePresenca(agendamentos), [agendamentos]);

  const mostrar = pendentes.slice(0, MAX);

  return (
    <aside className="glass-card rounded-xl p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Últimos {DIAS} dias
          </p>
          <h3 className="mt-1 flex items-center gap-2 text-base font-medium text-foreground">
            <ClipboardCheck className="h-4 w-4 text-amber-500" /> Presenças a marcar
          </h3>
        </div>
        {pendentes.length > 0 && (
          <span className="shrink-0 rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-bold text-amber-600">
            {pendentes.length}
          </span>
        )}
      </div>

      {pendentes.length === 0 ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm font-medium text-emerald-700">
          Tudo em dia. Nenhuma consulta dos últimos {DIAS} dias sem presença.
        </div>
      ) : (
        <div className="space-y-3">
          {mostrar.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="rounded-xl border border-amber-400/30 bg-amber-400/[0.04] p-3"
            >
              <button
                type="button"
                onClick={() => onEventClick(event)}
                className="w-full text-left"
              >
                <div className="flex items-center gap-2 text-foreground">
                  <UserRound className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate text-sm font-semibold leading-tight">
                    {event.Nome || "Paciente sem nome"}
                  </span>
                </div>
                <p className="mt-1 text-[12px] capitalize text-muted-foreground">
                  {event.parsedDate
                    ? format(event.parsedDate, "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })
                    : "Data inválida"}
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-amber-600">
                  <MessageCircleQuestion className="h-3.5 w-3.5 shrink-0" />
                  {event.Comparecimento_Perguntado_Em
                    ? "O bot perguntou e ele não respondeu"
                    : "O bot não chegou a perguntar"}
                </p>
              </button>
              <PresencaRapida event={event} className="mt-2.5" />
            </motion.div>
          ))}
          {pendentes.length > mostrar.length && (
            <p className="pt-1 text-center text-[11px] font-semibold text-muted-foreground">
              + {pendentes.length - mostrar.length} mais na agenda do dia
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
