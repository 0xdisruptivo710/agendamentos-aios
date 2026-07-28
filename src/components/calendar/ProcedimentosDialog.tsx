import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useProcedimentos, useCreateProcedimento, useDeleteProcedimento } from "@/hooks/useProcedimentos";

interface ProcedimentosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Gerenciar procedimentos/planos da unidade. Diferente das categorias, não há
// lista fixa: tudo aqui é cadastrado (o seed veio das exportações da agenda
// digital). O campo "Procedimento" continua texto livre; o cadastro alimenta o
// dropdown de sugestões junto com os valores já usados na agenda.
export function ProcedimentosDialog({ open, onOpenChange }: ProcedimentosDialogProps) {
  const { data: procedimentos, isLoading } = useProcedimentos();
  const createMutation = useCreateProcedimento();
  const deleteMutation = useDeleteProcedimento();
  const [nome, setNome] = useState("");

  const handleAdd = async () => {
    const clean = nome.trim();
    if (!clean) return toast.error("Informe o nome do procedimento");
    try {
      await createMutation.mutateAsync(clean);
      setNome("");
      toast.success("Procedimento adicionado");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error("Erro ao adicionar" + (msg ? ": " + msg : ""));
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Procedimento removido");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error("Erro ao remover" + (msg ? ": " + msg : ""));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-popover text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold gradient-text">
            <Sparkles className="h-5 w-5 text-primary" /> Procedimentos
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Cadastre os procedimentos e planos da unidade. Eles aparecem como sugestão no campo
          "Procedimento" ao criar ou editar um agendamento, junto com os já usados na agenda.
        </p>

        <div className="mt-2 flex items-center gap-2">
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            placeholder="Novo procedimento..."
            className="border-border bg-secondary/50"
          />
          <Button
            onClick={handleAdd}
            disabled={createMutation.isPending}
            className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Adicionar
          </Button>
        </div>

        <div className="mt-2 max-h-[45vh] space-y-1.5 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : !procedimentos || procedimentos.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum procedimento cadastrado ainda.</p>
          ) : (
            procedimentos.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate" title={p.nome}>{p.nome}</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(p.id)}
                  disabled={deleteMutation.isPending}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                  aria-label={`Remover ${p.nome}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
