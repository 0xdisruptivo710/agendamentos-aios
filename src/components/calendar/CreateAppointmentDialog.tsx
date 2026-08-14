import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useAgendamentos, useCreateAgendamentos } from "@/hooks/useAgendamentos";
import { firePainelWebhook } from "@/lib/painel-webhook";
import { monitorEspelhoInfosoft } from "@/lib/infosoft-monitor";
import { mergeCategorias, useCategorias } from "@/hooks/useCategorias";
import { ORIGEM_OPCOES } from "@/lib/agendamento-status";
import { generateOccurrences, normalizePhoneBR, singleOccurrence, WEEKDAYS } from "@/lib/agendamento-create";
import { motivoBloqueio, primeiraBloqueada } from "@/lib/agenda-bloqueios";
import { useBloqueios } from "@/hooks/useFeriados";
import { cn } from "@/lib/utils";
import type { EventSuggestions } from "@/components/calendar/EventDetailDialog";

interface CreateAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions?: EventSuggestions;
}

const today = () => format(new Date(), "yyyy-MM-dd");

export function CreateAppointmentDialog({ open, onOpenChange, suggestions }: CreateAppointmentDialogProps) {
  const unit = useUnit();
  const cfg = unit.config;
  const createMutation = useCreateAgendamentos();
  // Lista da unidade (cache do React Query) — usada só pela checagem de
  // horário único (config.horarioUnico).
  const { data: agendamentos } = useAgendamentos();

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
  // Dados de paciente do espelho Infosoft (config.infosoft) — opcionais: sem
  // eles o agendamento é criado normalmente e o espelho fica pendente até a
  // recepção completar (ou o paciente já existir no cadastro do ERP).
  const [cpf, setCpf] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [sexo, setSexo] = useState("");
  const [email, setEmail] = useState("");

  // Reset ao abrir (form limpo a cada novo agendamento).
  useEffect(() => {
    if (open) {
      setNome(""); setTelefone(""); setRecorrente(false); setHorario("08:00");
      setDataUnica(today()); setDataInicio(today()); setNumSessoes(8); setWeekdays([]);
      setTipo(""); setProcedimento(""); setRespAtendimento(""); setOrigem("");
      setCpf(""); setNascimento(""); setSexo(""); setEmail("");
    }
  }, [open]);

  const { data: categoriasExtras } = useCategorias();
  const categorias = mergeCategorias(cfg?.categorias ?? ["Avaliação", "Agendamento"], categoriasExtras);

  // Almoço e feriado (só nas unidades que declaram; nas demais vem tudo vazio
  // e nada é bloqueado).
  const bloqueios = useBloqueios();
  const ehBloqueada = useCallback(
    (d: string) => motivoBloqueio(d, bloqueios) !== null,
    [bloqueios],
  );

  // Na recorrência a data bloqueada é PULADA e a série segue até completar o
  // número de sessões — feriado no meio não pode fazer o paciente perder
  // sessão. `puladas` existe só para avisar quantas saíram do caminho.
  const { datas, puladas } = useMemo(() => {
    if (!recorrente) return { datas: singleOccurrence(dataUnica, horario), puladas: 0 };
    const entrada = { startDate: dataInicio, time: horario, weekdays, count: numSessoes };
    const semBloqueio = generateOccurrences(entrada);
    return {
      datas: generateOccurrences(entrada, ehBloqueada),
      puladas: semBloqueio.filter(ehBloqueada).length,
    };
  }, [recorrente, dataInicio, horario, weekdays, numSessoes, dataUnica, ehBloqueada]);

  const toggleWeekday = (v: number) =>
    setWeekdays((prev) => (prev.includes(v) ? prev.filter((d) => d !== v) : [...prev, v].sort((a, b) => a - b)));

  const handleSave = async () => {
    if (!nome.trim()) return toast.error("Informe o nome do paciente");
    const tel = normalizePhoneBR(telefone);
    if (!tel) return toast.error("Telefone inválido");
    if (recorrente && weekdays.length === 0) return toast.error("Selecione ao menos um dia da semana");
    if (datas.length === 0) {
      return toast.error(
        puladas > 0
          ? "Todas as datas caem em feriado ou no horário de almoço. Escolha outro horário."
          : "Nenhuma data para agendar",
      );
    }
    // Almoço/feriado. Na recorrência as datas já vêm filtradas; isto pega a
    // data única e serve de rede para qualquer caminho que escape do filtro.
    const bloqueada = primeiraBloqueada(datas, bloqueios);
    if (bloqueada) {
      return toast.error(`Não é possível agendar em ${bloqueada.data}: ${bloqueada.motivo}.`);
    }
    // Espelho Infosoft: o POST /agendar do ERP exige o serviço (servicoUuid),
    // resolvido pelo de-para categoria -> serviço. Sem categoria o espelho
    // nunca fecharia — por isso ela é obrigatória nas unidades com infosoft.
    if (cfg?.infosoft && !tipo) {
      return toast.error("Selecione a categoria — ela define o serviço no Infosoft");
    }
    // Horário único (config.horarioUnico): bloqueia agendar em cima de horário
    // já ocupado por outro paciente (agendamento não cancelado conta como ocupado).
    if (cfg?.horarioUnico) {
      const ocupados = new Set(
        (agendamentos ?? []).filter((a) => !a.Cancelamento && a.Data).map((a) => a.Data as string),
      );
      const conflito = datas.find((d) => ocupados.has(d));
      if (conflito) return toast.error(`Horário já ocupado (${conflito}). Escolha outro horário.`);
    }
    try {
      const cpfDigits = cpf.replace(/\D/g, "");
      if (cfg?.infosoft && cpfDigits && cpfDigits.length !== 11) {
        return toast.error("CPF inválido (11 dígitos)");
      }
      const { inserted, skipped } = await createMutation.mutateAsync({
        nome: nome.trim(),
        telefone: tel,
        datas,
        tipo: tipo || null,
        procedimento: procedimento || null,
        origem: origem || null,
        responsavelAtendimento: respAtendimento || null,
        cpf: cfg?.infosoft ? cpfDigits || null : null,
        nascimento: cfg?.infosoft ? nascimento || null : null,
        sexo: cfg?.infosoft ? sexo || null : null,
        email: cfg?.infosoft ? email.trim() || null : null,
      });
      if (inserted === 0) {
        toast.error("Nada criado: esses horários já existem");
        return;
      }
      toast.success(
        `${inserted} agendamento${inserted > 1 ? "s" : ""} criado${inserted > 1 ? "s" : ""}` +
          (skipped > 0 ? ` (${skipped} já existia${skipped > 1 ? "m" : ""})` : ""),
      );
      // Confirmação por WhatsApp via n8n (config.webhookAgendamento) — o n8n
      // resolve o canal da unidade e envia; falha aqui não afeta a criação.
      firePainelWebhook(cfg?.webhookAgendamento, {
        evento: "agendamento_criado",
        unidade: unit.slug,
        nome: nome.trim(),
        telefone: tel,
        datas,
        tipo: tipo || null,
        procedimento: procedimento || null,
      });
      // Espelho no Infosoft (config.webhookInfosoft) — payload leva também o
      // responsável (de-para de prestador) e os dados de paciente do ERP.
      firePainelWebhook(cfg?.webhookInfosoft, {
        evento: "agendamento_criado",
        unidade: unit.slug,
        nome: nome.trim(),
        telefone: tel,
        datas,
        tipo: tipo || null,
        procedimento: procedimento || null,
        responsavel: respAtendimento || null,
        cpf: cpfDigits || null,
        nascimento: nascimento || null,
        sexo: sexo || null,
        email: email.trim() || null,
      });
      // O espelho é assíncrono: acompanha o resultado e avisa se o ilife
      // recusar (ex.: horário ocupado) — senão a atendente acha que entrou.
      if (cfg?.infosoft) monitorEspelhoInfosoft(unit.table, tel, datas);
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
                    {puladas > 0 ? (
                      <span className="mt-1 block text-amber-700">
                        {puladas} {puladas === 1 ? "data pulada" : "datas puladas"} (feriado ou
                        horário de almoço) — a série seguiu para as próximas.
                      </span>
                    ) : null}
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
                {cfg?.infosoft && <span className="font-normal text-muted-foreground">(obrigatória — serviço no Infosoft)</span>}
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

          {/* Cadastro do paciente p/ o espelho no Infosoft (config.infosoft).
              Opcional: se o paciente já existe no ERP, o n8n resolve pelo
              telefone; se não, esses campos completam o cadastro. */}
          {cfg?.infosoft && (
            <div className="rounded-xl border border-border bg-secondary/30 p-3">
              <Label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <ClipboardList className="h-3.5 w-3.5 text-primary" /> Cadastro Infosoft (opcional)
              </Label>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Necessário só para paciente novo no ERP. Paciente já cadastrado é resolvido pelo telefone.
              </p>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">CPF</Label>
                  <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" className="border-border bg-card" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Nascimento</Label>
                  <Input type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} className="border-border bg-card" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Sexo</Label>
                  <Select value={sexo} onValueChange={setSexo}>
                    <SelectTrigger className="border-border bg-card"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="F">Feminino</SelectItem>
                      <SelectItem value="M">Masculino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">E-mail</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@..." className="border-border bg-card" />
                </div>
              </div>
            </div>
          )}

          <Button onClick={handleSave} disabled={createMutation.isPending} className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
            <Save className="mr-2 h-4 w-4" />
            {createMutation.isPending ? "Criando..." : `Criar ${datas.length > 1 ? datas.length + " sessões" : "agendamento"}`}
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
