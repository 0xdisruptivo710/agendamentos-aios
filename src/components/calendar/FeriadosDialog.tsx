import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarOff, Loader2, Lock, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useUnit } from "@/context/UnitContext";
import { useFeriados, useCreateFeriado, useDeleteFeriado } from "@/hooks/useFeriados";
import { feriadosNacionais } from "@/lib/agenda-bloqueios";
import { useAgendamentos } from "@/hooks/useAgendamentos";

interface FeriadosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const brDaISO = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

// Feriados da unidade. Os NACIONAIS aparecem como "padrão" (calculados, não
// removíveis); os próprios da clínica — padroeiro, emenda, recesso — são
// cadastrados aqui e passam a bloquear novos agendamentos naquele dia.
export function FeriadosDialog({ open, onOpenChange }: FeriadosDialogProps) {
  const unit = useUnit();
  const { data: feriados, isLoading, isError } = useFeriados();
  const createMutation = useCreateFeriado();
  const deleteMutation = useDeleteFeriado();
  const { data: agendamentos } = useAgendamentos();
  const [data, setData] = useState("");
  const [descricao, setDescricao] = useState("");

  const anoAtual = new Date().getFullYear();
  const nacionais = useMemo(() => {
    const lista = [...feriadosNacionais(anoAtual).entries()];
    return lista.sort((a, b) => {
      const [da, ma] = a[0].split("/");
      const [db, mb] = b[0].split("/");
      return `${ma}${da}`.localeCompare(`${mb}${db}`);
    });
  }, [anoAtual]);

  // Quantos pacientes já estão marcados em cada data cadastrada. Cadastrar o
  // feriado não mexe em agendamento nenhum — mas a recepção precisa VER quem
  // ficou para trás, senão o paciente aparece na porta em dia fechado.
  const marcadosPorData = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of agendamentos ?? []) {
      if (a.Cancelamento) continue;
      const dia = String(a.Data || "").slice(0, 10); // "dd/MM/yyyy"
      if (dia) m.set(dia, (m.get(dia) ?? 0) + 1);
    }
    return m;
  }, [agendamentos]);

  const handleAdd = async () => {
    if (!data) return toast.error("Escolha a data");
    try {
      await createMutation.mutateAsync({ data, descricao });
      const marcados = marcadosPorData.get(brDaISO(data)) ?? 0;
      setData("");
      setDescricao("");
      if (marcados > 0) {
        toast.warning(
          `Feriado adicionado. Atenção: ${marcados} ${marcados === 1 ? "paciente já está marcado" : "pacientes já estão marcados"} nessa data — remarque antes do dia.`,
          { duration: 10000 },
        );
      } else {
        toast.success("Feriado adicionado");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error("Erro ao adicionar" + (msg ? ": " + msg : ""));
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Feriado removido");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error("Erro ao remover" + (msg ? ": " + msg : ""));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarOff className="h-4 w-4" />
            Feriados — {unit.label}
          </DialogTitle>
        </DialogHeader>

        {isError ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Não consegui carregar os feriados cadastrados. Os nacionais e o horário de almoço
              seguem bloqueando; os seus próprios não estão sendo considerados agora.
            </span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[9rem]">
            <label className="mb-1 block text-xs text-muted-foreground">Data</label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="flex-[2] min-w-[11rem]">
            <label className="mb-1 block text-xs text-muted-foreground">Descrição (opcional)</label>
            <Input
              placeholder="Padroeiro, recesso, emenda…"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <Button onClick={handleAdd} disabled={createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        <div className="max-h-72 space-y-4 overflow-y-auto">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Cadastrados nesta unidade</p>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : (feriados ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum ainda.</p>
            ) : (
              <ul className="space-y-1">
                {(feriados ?? []).map((f) => {
                  const br = brDaISO(f.data);
                  const marcados = marcadosPorData.get(br) ?? 0;
                  return (
                    <li key={f.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{br}</span>
                        <span className="text-muted-foreground">{f.descricao || "Feriado"}</span>
                        {marcados > 0 ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                            {marcados} {marcados === 1 ? "paciente marcado" : "pacientes marcados"}
                          </span>
                        ) : null}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(f.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Nacionais {anoAtual} (automáticos)
            </p>
            <ul className="space-y-1">
              {nacionais.map(([dataBr, nome]) => (
                <li
                  key={dataBr}
                  className="flex items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-sm text-muted-foreground"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span className="font-medium">{dataBr}</span>
                  <span>{nome}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Carnaval e Corpus Christi são ponto facultativo e não entram sozinhos. Se a clínica
              fechar nesses dias, cadastre acima.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
