// Marcação RÁPIDA de presença (config.comparecimento).
//
// Por que existe: 36% das consultas passadas da OdontoCompany ficam com o bot
// perguntado e o paciente sem responder (60 de 166 em 14 dias, medido em
// 20/11/2026). Sem um jeito de marcar à mão em um clique, a agenda nunca fecha e
// a recepção volta a conferir presença no sistema da clínica — foi exatamente a
// queixa do dono em 19/11. Este hook grava a presença e notifica o n8n com o
// MESMO payload do modal (mensagem ao paciente + card no funil).
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useUpdateAgendamento, type Agendamento } from "@/hooks/useAgendamentos";
import { useUnit } from "@/context/UnitContext";
import { notificaPresenca } from "@/lib/presenca-webhook";
import { PRESENCA } from "@/lib/agendamento-status";

// Opções do botão rápido. A falta rápida entra como NÃO justificada: é o caso
// comum, e a justificativa pode ser escrita depois na ficha.
export const PRESENCA_RAPIDA = {
  COMPARECEU: PRESENCA.COMPARECEU,
  FALTOU: PRESENCA.FALTOU_NAO_JUSTIFICADA,
} as const;

export function useRegistrarPresenca() {
  const unit = useUnit();
  const cfg = unit.config;
  const update = useUpdateAgendamento();
  // id da linha em gravação — para o botão daquele card virar "Salvando...",
  // sem travar os outros cards.
  const [marcandoId, setMarcandoId] = useState<number | null>(null);

  const registrar = useCallback(
    async (event: Agendamento, presenca: string) => {
      if (!cfg?.presenca) return false;
      if ((event.Presenca ?? "") === presenca) {
        toast.info("Já estava marcado assim.");
        return true;
      }
      setMarcandoId(event.id);
      try {
        await update.mutateAsync({
          id: event.id,
          // Justificativa só faz sentido em falta justificada, que é escolhida
          // na ficha; o botão rápido limpa para não deixar texto órfão.
          updates: { Presenca: presenca, Justificativa: null },
        });
        notificaPresenca(cfg, unit.slug, event, presenca);
        toast.success(
          presenca === PRESENCA.COMPARECEU
            ? `${event.Nome || "Paciente"}: compareceu ✓`
            : `${event.Nome || "Paciente"}: falta registrada`,
        );
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        toast.error("Erro ao registrar presença" + (msg ? ": " + msg : ""));
        return false;
      } finally {
        setMarcandoId(null);
      }
    },
    [cfg, unit.slug, update],
  );

  return { registrar, marcandoId };
}
