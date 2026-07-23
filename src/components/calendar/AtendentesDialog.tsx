import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, Trash2, Stethoscope, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAtendentes, useCreateAtendente, useDeleteAtendente } from "@/hooks/useAtendentes";

interface AtendentesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AtendentesDialog({ open, onOpenChange }: AtendentesDialogProps) {
  const { data: atendentes, isLoading } = useAtendentes();
  const createMutation = useCreateAtendente();
  const deleteMutation = useDeleteAtendente();
  const [nome, setNome] = useState("");

  const handleAdd = async () => {
    const clean = nome.trim();
    if (!clean) return toast.error("Informe o nome do atendente");
    try {
      await createMutation.mutateAsync(clean);
      setNome("");
      toast.success("Atendente cadastrado");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error("Erro ao cadastrar" + (msg ? ": " + msg : ""));
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Atendente removido");
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
            <Stethoscope className="h-5 w-5 text-primary" /> Atendentes
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Cadastre os atendentes da unidade. Eles ficam disponíveis no campo "Resp. atendimento" ao criar
          ou editar um agendamento e passam a aparecer nos relatórios quando atribuídos.
        </p>

        <div className="mt-2 flex items-center gap-2">
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            placeholder="Nome do atendente..."
            className="border-border bg-secondary/50"
          />
          <Button
            onClick={handleAdd}
            disabled={createMutation.isPending}
            className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <UserPlus className="mr-1.5 h-4 w-4" /> Adicionar
          </Button>
        </div>

        <div className="mt-2 max-h-[45vh] space-y-1.5 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : !atendentes || atendentes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum atendente cadastrado ainda.</p>
          ) : (
            atendentes.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Stethoscope className="h-3.5 w-3.5 text-primary" /> {a.nome}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(a.id)}
                  disabled={deleteMutation.isPending}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  aria-label={`Remover ${a.nome}`}
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
