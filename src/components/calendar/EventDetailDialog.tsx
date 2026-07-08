import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Phone, CheckCircle, Clock, AlertCircle, Save, StickyNote, DollarSign, UserCog, Stethoscope, ClipboardList, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import type { Agendamento } from "@/hooks/useAgendamentos";
import { useUpdateAgendamento } from "@/hooks/useAgendamentos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export interface EventSuggestions {
  respAgendamento: string[];
  respAtendimento: string[];
  procedimento: string[];
}

interface EventDetailDialogProps {
  event: Agendamento | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions?: EventSuggestions;
}

function getStatusConfig(confirmacao: string | null) {
  if (!confirmacao) return { icon: Clock, label: "Pendente", color: "text-green-400", bg: "bg-green-300/10" };
  const lower = confirmacao.toLowerCase();
  if (lower.includes("confirm") || lower.includes("ok")) return { icon: CheckCircle, label: "Confirmado", color: "text-green-500", bg: "bg-green-400/10" };
  if (lower.includes("cancel") || lower.includes("desmarc")) return { icon: AlertCircle, label: "Cancelado", color: "text-destructive", bg: "bg-destructive/10" };
  return { icon: Clock, label: confirmacao, color: "text-primary", bg: "bg-primary/10" };
}

export function EventDetailDialog({ event, open, onOpenChange, suggestions }: EventDetailDialogProps) {
  const [notes, setNotes] = useState("");
  const [valor, setValor] = useState<string>("");
  const [respAgendamento, setRespAgendamento] = useState("");
  const [respAtendimento, setRespAtendimento] = useState("");
  const [tipo, setTipo] = useState<string>("");
  const [procedimento, setProcedimento] = useState<string>("");
  const updateMutation = useUpdateAgendamento();

  useEffect(() => {
    if (event) {
      setNotes(event.Anotações || "");
      setValor(event.Valor != null ? String(event.Valor) : "");
      setRespAgendamento(event.Responsavel_Agendamento || "");
      setRespAtendimento(event.Responsavel_Atendimento || "");
      setTipo(event.Tipo || "");
      setProcedimento(event.Procedimento || "");
    }
  }, [event]);

  if (!event) return null;

  const status = getStatusConfig(event.Confirmação);
  const StatusIcon = status.icon;
  const parsedDate = event.parsedDate;

  const handleSave = async () => {
    try {
      const valorParsed = valor.trim() === "" ? null : Number(valor.replace(",", "."));
      if (valor.trim() !== "" && Number.isNaN(valorParsed)) {
        toast.error("Valor inválido");
        return;
      }
      await updateMutation.mutateAsync({
        id: event.id,
        updates: {
          Anotações: notes,
          Valor: valorParsed,
          Responsavel_Agendamento: respAgendamento || null,
          Responsavel_Atendimento: respAtendimento || null,
          Tipo: tipo || null,
          Procedimento: procedimento || null,
        },
      });
      toast.success("Agendamento atualizado!");
    } catch (e: any) {
      toast.error("Erro ao salvar" + (e?.message ? ": " + e.message : ""));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto border-border bg-popover text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold gradient-text">Detalhes do agendamento</DialogTitle>
        </DialogHeader>

        {/* datalists de sugestão (valores já presentes na base da unidade) */}
        <datalist id="resp-ag-suggestions">
          {(suggestions?.respAgendamento ?? []).map((v) => <option key={v} value={v} />)}
        </datalist>
        <datalist id="resp-at-suggestions">
          {(suggestions?.respAtendimento ?? []).map((v) => <option key={v} value={v} />)}
        </datalist>
        <datalist id="procedimento-suggestions">
          {(suggestions?.procedimento ?? []).map((v) => <option key={v} value={v} />)}
        </datalist>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-2 space-y-4">
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${status.bg}`}>
            <StatusIcon className={`h-4 w-4 ${status.color}`} />
            <span className={`text-sm font-semibold ${status.color}`}>{status.label}</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="glass-card rounded-xl p-3">
              <div className="mb-1 flex items-center gap-2">
                <User className="h-4 w-4 text-green-400" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Paciente</span>
              </div>
              <p className="text-sm font-bold text-foreground">{event.Nome || "Não informado"}</p>
            </div>
            <div className="glass-card rounded-xl p-3">
              <div className="mb-1 flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Telefone</span>
              </div>
              <p className="text-sm font-bold text-foreground">{event["Número"] || "Não informado"}</p>
            </div>
          </div>

          <div className="glass-card rounded-xl p-3">
            <div className="mb-1 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Data</span>
            </div>
            <p className="text-sm font-bold capitalize text-foreground">
              {parsedDate ? format(parsedDate, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR }) : "Data inválida"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <DollarSign className="h-3.5 w-3.5 text-green-400" /> Valor da venda (R$)
              </Label>
              <Input
                type="text"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="border-border bg-secondary/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <ClipboardList className="h-3.5 w-3.5 text-green-400" /> Tipo
              </Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="border-border bg-secondary/50">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Avaliação">Avaliação</SelectItem>
                  <SelectItem value="Agendamento">Agendamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <UserCog className="h-3.5 w-3.5 text-green-400" /> Resp. agendamento
              </Label>
              <Input
                list="resp-ag-suggestions"
                value={respAgendamento}
                onChange={(e) => setRespAgendamento(e.target.value)}
                placeholder="Nome..."
                className="border-border bg-secondary/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Stethoscope className="h-3.5 w-3.5 text-green-400" /> Resp. atendimento
              </Label>
              <Input
                list="resp-at-suggestions"
                value={respAtendimento}
                onChange={(e) => setRespAtendimento(e.target.value)}
                placeholder="Nome..."
                className="border-border bg-secondary/50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-green-400" /> Procedimento realizado
            </Label>
            <Input
              list="procedimento-suggestions"
              value={procedimento}
              onChange={(e) => setProcedimento(e.target.value)}
              placeholder="Procedimento..."
              className="border-border bg-secondary/50"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-green-400" />
              <span className="text-sm font-semibold text-foreground">Anotações</span>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Escreva suas anotações sobre este agendamento..."
              className="min-h-[100px] resize-none border-border bg-secondary/50 text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-primary/40"
            />
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
              <Save className="mr-2 h-4 w-4" />
              {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
