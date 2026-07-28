import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Phone, Clock, Repeat, CalendarPlus, Save, ClipboardList, Sparkles, Stethoscope, Building2, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { toast } from "sonner";
import { useUnit } from "@/context/UnitContext";
import { useCreateAgendamentos } from "@/hooks/useAgendamentos";
import { mergeCategorias, useCategorias } from "@/hooks/useCategorias";
import { ORIGEM_OPCOES } from "@/lib/agendamento-status";
import { generateOccurrences, normalizePhoneBR, singleOccurrence, WEEKDAYS } from "@/lib/agendamento-create";
import { cn } from "@/lib/utils";
import type { EventSuggestions } from "@/components/calendar/EventDetailDialog";

interface CreateAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions?: EventSuggestions;
}

const today = () => format(new Date(), "yyyy-MM-dd");

export function CreateAppointmentDialog({ open, onOpenChange, suggestions }: CreateAppointmentDialogProps) {
  const cfg = useUnit().config;
  const createMutation = useCreateAgendamentos();

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [horario, setHorario] = useState("08:00");
  const [dataUnica, setDataUnica] = useState(today);
  const [dataInicio, setDataInicio] = useState(today);
  const [numSessoes, setNumSessoes] = useState(8);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [tipo, setTipo] = useState("");
  const [procedimento, setProcedimento] = useState("");
  const [respAtendimento, setRespAtendimento] = useState("");
  const [origem, setOrigem] = useState("");

  // Reset ao abrir (form limpo a cada novo agendamento).
  useEffect(() => {
    if (open) {
      setNome(""); setTelefone(""); setRecorrente(false); setHorario("08:00");
      setDataUnica(today()); setDataInicio(today()); setNumSessoes(8); setWeekdays([]);
      setTipo(""); setProcedimento(""); setRespAtendimento(""); setOrigem("");
    }
  }, [open]);

  const { data: categoriasExtras } = useCategorias();
  const categorias = mergeCategorias(cfg?.categorias ?? ["Avaliação", "Agendamento"], categoriasExtras);

  const datas = useMemo(
    () =>
      recorrente
        ? generateOccurrences({ startDate: dataInicio, time: horario, weekdays, count: numSessoes })
        : singleOccurrence(dataUnica, horario),
    [recorrente, dataInicio, horario, weekdays, numSessoes, dataUnica],
  );

  const toggleWeekday = (v: number) =>
    setWeekdays((prev) => (prev.includes(v) ? prev.filter((d) => d !== v) : [...prev, v].sort((a, b) => a - b)));

  const handleSave = async () => {
    if (!nome.trim()) return toast.error("Informe o nome do paciente");
    const tel = normalizePhoneBR(telefone);
    if (!tel) return toast.error("Telefone inválido");
    if (recorrente && weekdays.length === 0) return toast.error("Selecione ao menos um dia da semana");
    if (datas.length === 0) return toast.error("Nenhuma data para agendar");
    try {
      const { inserted, skipped } = await createMutation.mutateAsync({
        nome: nome.trim(),
        telefone: tel,
        datas,
        tipo: tipo || null,
        procedimento: procedimento || null,
        origem: origem || null,
        responsavelAtendimento: respAtendimento || null,
      });
      if (inserted === 0) {
        toast.error("Nada criado: esses horários já existem");
        return;
      }
      toast.success(
        `${inserted} agendamento${inserted > 1 ? "s" : ""} criado${inserted > 1 ? "s" : ""}` +
          (skipped > 0 ? ` (${skipped} já existia${skipped > 1 ? "m" : ""})` : ""),
      );
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error("Erro ao criar" + (msg ? ": " + msg : ""));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto border-border bg-popover text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold gradient-text">
            <CalendarPlus className="h-5 w-5 text-primary" /> Novo agendamento
          </DialogTitle>
        </DialogHeader>

        <datalist id="create-proc-suggestions">
          {(suggestions?.procedimento ?? []).map((v) => <option key={v} value={v} />)}
        </datalist>
        <datalist id="create-resp-at-suggestions">
          {(suggestions?.respAtendimento ?? []).map((v) => <option key={v} value={v} />)}
        </datalist>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-1 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <User className="h-3.5 w-3.5 text-primary" /> Nome do paciente
              </Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome..." className="border-border bg-secondary/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Phone className="h-3.5 w-3.5 text-primary" /> Telefone (WhatsApp)
              </Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(51) 99999-9999" className="border-border bg-secondary/50" />
            </div>
          </div>

          {/* Recorrência */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Repeat className="h-3.5 w-3.5 text-primary" /> Agendamento recorrente
              </Label>
              <Switch checked={recorrente} onCheckedChange={setRecorrente} />
            </div>

            {!recorrente ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Data</Label>
                  <Input type="date" value={dataUnica} onChange={(e) => setDataUnica(e.target.value)} className="border-border bg-card" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Horário</Label>
                  <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} className="border-border bg-card" />
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div>
                  <Label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Dias da semana</Label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((w) => {
                      const active = weekdays.includes(w.value);
                      return (
                        <button
                          key={w.value}
                          type="button"
                          onClick={() => toggleWeekday(w.value)}
                          className={cn(
                            "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                            active
                              ? "border-primary/60 bg-primary/15 text-primary"
                              : "border-border bg-secondary/50 text-muted-foreground hover:bg-secondary",
                          )}
                        >
                          {w.short}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Início</Label>
                    <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="border-border bg-card" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Horário</Label>
                    <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} className="border-border bg-card" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Nº sessões</Label>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={numSessoes}
                      onChange={(e) => setNumSessoes(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
                      className="border-border bg-card"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Preview das datas geradas */}
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="text-[11px] text-muted-foreground">
                {datas.length === 0 ? (
                  <span>Nenhuma sessão definida ainda.</span>
                ) : (
                  <>
                    <span className="font-semibold text-foreground">
                      {datas.length} {datas.length > 1 ? "sessões" : "sessão"}:
                    </span>{" "}
                    {datas.slice(0, 6).join(" · ")}
                    {datas.length > 6 ? ` · +${datas.length - 6}` : ""}
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Opcionais */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <ClipboardList className="h-3.5 w-3.5 text-primary" /> Categoria
              </Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="border-border bg-secondary/50"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {cfg?.origem && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Building2 className="h-3.5 w-3.5 text-primary" /> Origem
                </Label>
                <Select value={origem} onValueChange={setOrigem}>
                  <SelectTrigger className="border-border bg-secondary/50"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {ORIGEM_OPCOES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Procedimento
              </Label>
              <Input list="create-proc-suggestions" value={procedimento} onChange={(e) => setProcedimento(e.target.value)} placeholder="Procedimento..." className="border-border bg-secondary/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Stethoscope className="h-3.5 w-3.5 text-primary" /> Resp. atendimento
              </Label>
              <Input list="create-resp-at-suggestions" value={respAtendimento} onChange={(e) => setRespAtendimento(e.target.value)} placeholder="Nome..." className="border-border bg-secondary/50" />
            </div>
          </div>

          <Button onClick={handleSave} disabled={createMutation.isPending} className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
            <Save className="mr-2 h-4 w-4" />
            {createMutation.isPending ? "Criando..." : `Criar ${datas.length > 1 ? datas.length + " sessões" : "agendamento"}`}
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
