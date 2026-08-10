// Acompanha o resultado do espelho Infosoft de um agendamento recém-criado e
// avisa a atendente. O espelho é assíncrono (n8n grava o resultado em
// infosoft_status na linha da agenda): o painel salva na hora, mas o ERP pode
// recusar (ex.: horário ocupado) — sem este aviso a recepção acharia que o
// agendamento entrou no ilife.
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TENTATIVAS = 6;
const INTERVALO_MS = 4000;

export function monitorEspelhoInfosoft(table: string, telefone: string, datas: string[]) {
  let tentativa = 0;
  const checa = async () => {
    tentativa++;
    const { data } = await supabase
      .from(table)
      .select("Data, infosoft_status")
      .eq("Número", telefone)
      .in("Data", datas);
    const rows = (data ?? []) as { Data: string; infosoft_status: string | null }[];
    const aindaProcessando = rows.length < datas.length || rows.some((r) => !r.infosoft_status);
    if (aindaProcessando && tentativa < TENTATIVAS) {
      setTimeout(checa, INTERVALO_MS);
      return;
    }
    const erros = rows.filter((r) => r.infosoft_status?.startsWith("ERRO"));
    const pendentes = rows.filter((r) => r.infosoft_status?.startsWith("PENDENTE"));
    if (erros.length > 0) {
      for (const r of erros) {
        toast.error(`NÃO entrou no Infosoft (${r.Data}): ${(r.infosoft_status ?? "").replace(/^ERRO:?\s*/, "")}`, {
          duration: 60000,
          description: "O agendamento existe SÓ no painel. Confira a agenda do ilife e ajuste o horário se preciso.",
        });
      }
    } else if (pendentes.length > 0) {
      toast.warning("Espelho Infosoft pendente — faltou dado de cadastro; a recepção precisa agendar no ilife.", {
        duration: 30000,
      });
    } else if (!aindaProcessando && rows.length > 0) {
      toast.success("Agendamento espelhado no Infosoft ✓");
    } else {
      toast.info("Espelho Infosoft ainda processando — o status aparece no agendamento em instantes.", {
        duration: 15000,
      });
    }
  };
  setTimeout(checa, INTERVALO_MS);
}
