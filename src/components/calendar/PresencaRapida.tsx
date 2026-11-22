// Dois botões para fechar o comparecimento sem abrir nada: "Compareceu" grava
// em 1 clique; "Faltou" pede confirmação (2 cliques) porque dispara mensagem de
// falta para o paciente e move o card no funil — erro de clique aqui sai do
// painel e chega no WhatsApp dele.
//
// Mora dentro de cards clicáveis (card do dia, painel de pendências), por isso
// todo clique para a propagação.
import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import type { Agendamento } from "@/hooks/useAgendamentos";
import { useRegistrarPresenca, PRESENCA_RAPIDA } from "@/hooks/usePresenca";
import { cn } from "@/lib/utils";

interface PresencaRapidaProps {
  event: Agendamento;
  className?: string;
}

export function PresencaRapida({ event, className }: PresencaRapidaProps) {
  const { registrar, marcandoId } = useRegistrarPresenca();
  const [armado, setArmado] = useState(false);
  const gravando = marcandoId === event.id;

  // A confirmação de falta se desarma sozinha: o botão não fica "armado"
  // esperando um clique distraído minutos depois.
  useEffect(() => {
    if (!armado) return;
    const t = setTimeout(() => setArmado(false), 5000);
    return () => clearTimeout(t);
  }, [armado]);

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const base =
    "inline-flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-60";

  return (
    <div className={cn("flex gap-2", className)}>
      <button
        type="button"
        disabled={gravando}
        onClick={(e) => {
          stop(e);
          void registrar(event, PRESENCA_RAPIDA.COMPARECEU);
        }}
        className={cn(base, "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20")}
      >
        <Check className="h-3.5 w-3.5" />
        {gravando ? "Salvando..." : "Compareceu"}
      </button>
      <button
        type="button"
        disabled={gravando}
        onClick={(e) => {
          stop(e);
          if (!armado) {
            setArmado(true);
            return;
          }
          setArmado(false);
          void registrar(event, PRESENCA_RAPIDA.FALTOU);
        }}
        className={cn(
          base,
          armado
            ? "border-destructive bg-destructive/20 text-destructive"
            : "border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/15",
        )}
      >
        <X className="h-3.5 w-3.5" />
        {armado ? "Confirmar falta" : "Faltou"}
      </button>
    </div>
  );
}

// A consulta já passou do horário + folga e ninguém registrou presença? Então a
// marcação rápida aparece. Mesma folga de 1h que o bot usa para perguntar: antes
// disso o paciente ainda pode estar na cadeira.
export function precisaMarcarPresenca(event: Agendamento, now: Date = new Date()): boolean {
  if (event.Presenca) return false;
  if ((event.Cancelamento ?? "").trim()) return false;
  if (!event.parsedDate) return false;
  return now.getTime() - event.parsedDate.getTime() >= 60 * 60 * 1000;
}

// Janela da FILA de presenças a marcar. Fora dela ninguém mais lembra se o
// paciente veio, e o número viraria um passivo histórico (a base da
// OdontoCompany tem 468 linhas sem presença desde antes do bot existir) em vez
// de uma tarefa do dia. O cartão do topo e o painel da direita usam esta mesma
// conta, para não mostrarem números diferentes para a mesma coisa.
export const DIAS_PENDENTES = 7;

export function pendentesDePresenca(agendamentos: Agendamento[], now: Date = new Date()): Agendamento[] {
  const limite = now.getTime() - DIAS_PENDENTES * 24 * 60 * 60 * 1000;
  return agendamentos
    .filter((a) => precisaMarcarPresenca(a, now) && a.parsedDate && a.parsedDate.getTime() >= limite)
    .sort((a, b) => (b.parsedDate?.getTime() ?? 0) - (a.parsedDate?.getTime() ?? 0));
}
