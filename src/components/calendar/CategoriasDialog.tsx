import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClipboardList, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useUnit } from "@/context/UnitContext";
import { useCategorias, useCreateCategoria, useDeleteCategoria } from "@/hooks/useCategorias";

interface CategoriasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Gerenciar categorias da unidade: as fixas (config) aparecem como "padrão"
// (não removíveis); as extras são adicionadas/removidas aqui e entram nos
// Selects de Categoria dos modais de criar/editar agendamento.
export function CategoriasDialog({ open, onOpenChange }: CategoriasDialogProps) {
  const cfg = useUnit().config;
  const { data: categorias, isLoading } = useCategorias();
  const createMutation = useCreateCategoria();
  const deleteMutation = useDeleteCategoria();
  const [nome, setNome] = useState("");

  const fixas = cfg?.categorias ?? ["Avaliação", "Agendamento"];

  const handleAdd = async () => {
    const clean = nome.trim();
    if (!clean) return toast.error("Informe o nome da categoria");
    if (fixas.some((f) => f.trim().toLowerCase() === clean.toLowerCase())) {
      return toast.error("Essa categoria já existe");
    }
    try {
      await createMutation.mutateAsync(clean);
      setNome("");
      toast.success("Categoria adicionada");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error("Erro ao adicionar" + (msg ? ": " + msg : ""));
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Categoria removida");
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
            <ClipboardList className="h-5 w-5 text-primary" /> Categorias
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Adicione categorias próprias da unidade. Elas aparecem no campo "Categoria" ao criar
          ou editar um agendamento, junto com as categorias padrão.
        </p>

        <div className="mt-2 flex items-center gap-2">
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            placeholder="Nova categoria..."
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
          {fixas.map((c) => (
            <div key={c} className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2">
              <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ClipboardList className="h-3.5 w-3.5 text-primary/60" /> {c}
              </span>
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
                <Lock className="h-3 w-3" /> padrão
              </span>
            </div>
          ))}

          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (
            (categorias ?? []).map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <ClipboardList className="h-3.5 w-3.5 text-primary" /> {c.nome}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(c.id)}
                  disabled={deleteMutation.isPending}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  aria-label={`Remover ${c.nome}`}
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
