import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Phone, CheckCircle, Clock, AlertCircle, Save, StickyNote, DollarSign, UserCog, Stethoscope, ClipboardList, Sparkles, CalendarCheck, CalendarX, UserCheck, Building2, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import type { Agendamento } from "@/hooks/useAgendamentos";
import { useUpdateAgendamento, useDeleteAgendamento, useDeleteAgendamentos, useReagendarSessoes } from "@/hooks/useAgendamentos";
import { useCategorias, mergeCategorias } from "@/hooks/useCategorias";
import { buildDataString, findFutureSiblings, sessoesFuturasDoPaciente, shiftSessao } from "@/lib/agendamento-reagendar";
import { firePainelWebhook } from "@/lib/painel-webhook";
import { useUnit } from "@/context/UnitContext";
import {
  deriveStatus,
  guessOrigem,
  AGENDOU,
  ORIGEM,
  ORIGEM_OPCOES,
  PRESENCA,
  PRESENCA_OPCOES,
  type StatusTone,
} from "@/lib/agendamento-status";
import { cn } from "@/lib/utils";
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
  // Lista completa da unidade — usada só pela edição de data/horário
  // (config.editarData) para achar as sessões futuras da mesma recorrência.
  agendamentos?: Agendamento[];
}

const TONE_ICON: Record<StatusTone, typeof CheckCircle> = {
  success: CheckCircle,
  danger: AlertCircle,
  warning: Clock,
  primary: Clock,
  muted: Clock,
};

const TONE_CHIP_STRONG: Record<StatusTone, string> = {
  success: "bg-green-400/10 text-green-500",
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-amber-400/10 text-amber-500",
  primary: "bg-primary/10 text-primary",
  muted: "bg-primary/10 text-primary",
};

// Classe do botão ATIVO de um controle segmentado, por tom semântico.
const ACTIVE_TONE: Record<"success" | "danger" | "warning" | "primary", string> = {
  success: "border-green-400/60 bg-green-400/15 text-green-500",
  danger: "border-destructive/60 bg-destructive/15 text-destructive",
  warning: "border-amber-400/60 bg-amber-400/15 text-amber-500",
  primary: "border-primary/50 bg-primary/10 text-primary",
};

interface SegOption {
  value: string;
  label: string;
  activeClass: string;
}

// Controle segmentado simples (sem dependência nova). Clicar no item ativo limpa
// a seleção (volta a "não registrado").
function Segmented({ value, options, onChange }: { value: string; options: SegOption[]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(active ? "" : o.value)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
              active ? o.activeClass : "border-border bg-secondary/50 text-muted-foreground hover:bg-secondary",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function EventDetailDialog({ event, open, onOpenChange, suggestions, agendamentos }: EventDetailDialogProps) {
  const unit = useUnit();
  const cfg = unit.config;
  const [notes, setNotes] = useState("");
  const [valor, setValor] = useState<string>("");
  const [respAgendamento, setRespAgendamento] = useState("");
  const [respAtendimento, setRespAtendimento] = useState("");
  const [tipo, setTipo] = useState<string>("");
  const [procedimento, setProcedimento] = useState<string>("");
  const [agendou, setAgendou] = useState<string>("");
  const [origem, setOrigem] = useState<string>("");
  const [presenca, setPresenca] = useState<string>("");
  const [justificativa, setJustificativa] = useState<string>("");
  const [dataEdit, setDataEdit] = useState<string>("");   // "yyyy-MM-dd"
  const [horaEdit, setHoraEdit] = useState<string>("");   // "HH:mm"
  const [aplicarFuturas, setAplicarFuturas] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteFuturas, setConfirmDeleteFuturas] = useState(false);
  // Última presença JÁ NOTIFICADA ao n8n (NPS/falta). Ref, e não event.Presenca,
  // porque o objeto `event` fica stale após o 1º save (o pai mantém a referência
  // selecionada) — comparar com ele reenviaria a mensagem a cada Salvar.
  const presencaNotificada = useRef<string | null>(null);
  const updateMutation = useUpdateAgendamento();
  const deleteMutation = useDeleteAgendamento();
  const deleteFuturasMutation = useDeleteAgendamentos();
  const reagendarMutation = useReagendarSessoes();
  const { data: categoriasExtras } = useCategorias();

  useEffect(() => {
    if (event) {
      setConfirmDelete(false);
      setConfirmDeleteFuturas(false);
      setNotes(event.Anotações || "");
      setValor(event.Valor != null ? String(event.Valor) : "");
      setRespAgendamento(event.Responsavel_Agendamento || "");
      setRespAtendimento(event.Responsavel_Atendimento || "");
      setTipo(event.Tipo || "");
      setProcedimento(event.Procedimento || "");
      setAgendou(event.Agendou || "");
      // Origem: usa o valor gravado; se vazio, sugere a partir do procedimento
      // (não-destrutivo — só preenche o formulário, o usuário confirma no Salvar).
      setOrigem(event.Origem || (cfg?.origem ? guessOrigem(event.Procedimento) ?? "" : ""));
      setPresenca(event.Presenca || "");
      setJustificativa(event.Justificativa || "");
      setDataEdit(event.parsedDate ? format(event.parsedDate, "yyyy-MM-dd") : "");
      setHoraEdit(event.parsedDate ? format(event.parsedDate, "HH:mm") : "");
      setAplicarFuturas(false);
      presencaNotificada.current = event.Presenca ?? null;
    }
  }, [event, cfg?.origem]);

  // Sessões futuras da mesma recorrência (mesmo paciente, dia da semana e
  // horário) — alvo do "aplicar às sessões futuras" da edição de data.
  const sessoesFuturas = useMemo(
    () => (cfg?.editarData && event && agendamentos ? findFutureSiblings(event, agendamentos) : []),
    [cfg?.editarData, event, agendamentos],
  );

  // TODAS as sessões futuras do paciente (qualquer dia/horário), inclusive a
  // aberta se futura — alvo do "Excluir todos os futuros" (config.excluirFuturos).
  const futurasDoPaciente = useMemo(
    () => (cfg?.excluirFuturos && event && agendamentos ? sessoesFuturasDoPaciente(event, agendamentos) : []),
    [cfg?.excluirFuturos, event, agendamentos],
  );

  if (!event) return null;

  const categorias = mergeCategorias(cfg?.categorias ?? ["Avaliação", "Agendamento"], categoriasExtras);
  // Valor legado que saiu da lista (ex.: categoria removida) continua visível.
  if (tipo && !categorias.includes(tipo)) categorias.push(tipo);
  const status = deriveStatus(event);
  const StatusIcon = TONE_ICON[status.tone];
  const parsedDate = event.parsedDate;

  // A data/hora do formulário difere da gravada? (só com ambos preenchidos)
  const origData = parsedDate ? format(parsedDate, "yyyy-MM-dd") : "";
  const origHora = parsedDate ? format(parsedDate, "HH:mm") : "";
  const dataAlterada = !!cfg?.editarData && !!dataEdit && !!horaEdit && (dataEdit !== origData || horaEdit !== origHora);

  const presencaOptions: SegOption[] = [
    { value: PRESENCA.COMPARECEU, label: "Compareceu", activeClass: ACTIVE_TONE.success },
    { value: PRESENCA.FALTOU_JUSTIFICADA, label: "Faltou (justificada)", activeClass: ACTIVE_TONE.warning },
    { value: PRESENCA.FALTOU_NAO_JUSTIFICADA, label: "Faltou (não justificada)", activeClass: ACTIVE_TONE.danger },
  ];
  const agendouOptions: SegOption[] = [
    { value: AGENDOU.SIM, label: "Sim", activeClass: ACTIVE_TONE.success },
    { value: AGENDOU.NAO, label: "Não", activeClass: ACTIVE_TONE.danger },
  ];

  const handleSave = async () => {
    try {
      const valorParsed = valor.trim() === "" ? null : Number(valor.replace(",", "."));
      if (valor.trim() !== "" && Number.isNaN(valorParsed)) {
        toast.error("Valor inválido");
        return;
      }
      const updates: Partial<Agendamento> = {
        Anotações: notes,
        Valor: valorParsed,
        Responsavel_Agendamento: respAgendamento || null,
        Responsavel_Atendimento: respAtendimento || null,
        Tipo: tipo || null,
        Procedimento: procedimento || null,
      };
      // Só envia os campos clínicos quando a unidade os habilita — assim nenhuma
      // outra tabela recebe colunas que não possui.
      if (cfg?.agendou) updates.Agendou = agendou || null;
      if (cfg?.origem) updates.Origem = origem || null;
      if (cfg?.presenca) {
        updates.Presenca = presenca || null;
        // Justificativa só faz sentido em falta justificada.
        updates.Justificativa = presenca === PRESENCA.FALTOU_JUSTIFICADA ? justificativa || null : null;
      }
      // Edição de data/horário (config.editarData): só entra no update quando o
      // formulário difere do gravado, para não reescrever Data à toa.
      if (dataAlterada) {
        const novaData = buildDataString(dataEdit, horaEdit);
        if (!novaData) {
          toast.error("Data ou horário inválido");
          return;
        }
        // Horário único (config.horarioUnico): não deixa MOVER para um horário
        // já ocupado por outro paciente. (A propagação às sessões futuras segue
        // reportando conflitos pelo próprio retorno do reagendar.)
        if (cfg?.horarioUnico) {
          const ocupado = (agendamentos ?? []).some(
            (a) => a.id !== event.id && !a.Cancelamento && a.Data === novaData,
          );
          if (ocupado) {
            toast.error("Horário já ocupado por outro paciente. Escolha outro horário.");
            return;
          }
        }
        updates.Data = novaData;
      }
      await updateMutation.mutateAsync({ id: event.id, updates });

      // Presença via n8n: dispara só quando a presença MUDOU para um valor ainda
      // não notificado — salvar de novo com a mesma presença não reenvia nada.
      // Dois webhooks INDEPENDENTES com o mesmo payload:
      //   webhookPresenca     -> NPS (Compareceu) / mensagem de falta
      //   webhookPresencaCard -> card do paciente no funil do WTS
      // Separados de propósito: falha na sincronização do card não pode atrasar
      // nem impedir a mensagem ao paciente.
      if (cfg?.presenca && presenca && presenca !== presencaNotificada.current) {
        const payload = {
          evento: "presenca",
          unidade: unit.slug,
          // Quem resolve a unidade no WTS é o canal, não o slug: a agenda geral
          // atende as duas clínicas.
          canal: event.Canal,
          presenca,
          nome: event.Nome,
          telefone: event["Número"],
          // Data EFETIVA: se o mesmo Salvar também remarcou, a linha no banco já
          // é a nova, e é por (Número, Data) que o n8n acha a linha de volta.
          data: updates.Data ?? event.Data,
        };
        firePainelWebhook(cfg?.webhookPresenca, payload);
        firePainelWebhook(cfg?.webhookPresencaCard, payload);
        presencaNotificada.current = presenca;
      }

      // Propaga o deslocamento (dia da semana + horário) às sessões futuras da
      // recorrência, mantendo cada uma na própria semana.
      let mudancasFuturas: { de: string; para: string }[] = [];
      if (dataAlterada && aplicarFuturas && sessoesFuturas.length > 0 && parsedDate) {
        const [y, m, d] = dataEdit.split("-").map(Number);
        const delta = new Date(y, m - 1, d).getDay() - parsedDate.getDay();
        const pares = sessoesFuturas
          .map((s) => ({ id: s.id, de: s.Data, para: shiftSessao(s, delta, horaEdit) }))
          .filter((p): p is { id: number; de: string; para: string } => !!p.de && !!p.para);
        const { updated, conflicts } = await reagendarMutation.mutateAsync(
          pares.map((p) => ({ id: p.id, data: p.para })),
        );
        // Espelho Infosoft: as futuras só entram quando TODAS moveram — com
        // conflito não dá pra saber qual ficou, e mover errado no ERP é pior
        // que a recepção resolver a pendência aqui.
        if (conflicts === 0) mudancasFuturas = pares.map(({ de, para }) => ({ de, para }));
        toast.success(
          `Agendamento atualizado! ${updated} ${updated === 1 ? "sessão futura remarcada" : "sessões futuras remarcadas"}.` +
            (conflicts > 0 ? ` ${conflicts} não ${conflicts === 1 ? "movida" : "movidas"} (horário já ocupado).` : ""),
        );
      } else {
        toast.success("Agendamento atualizado!");
      }

      // Remarcação notifica o n8n em DOIS webhooks independentes:
      //   webhookAgendamento -> mensagem de remarcação ao paciente. SÓ nas
      //     unidades do rollout (config.webhookTodosEventos): as que já tinham
      //     n8n conectado antes (pilotos/Odonto) esperam só o evento de criação.
      //   webhookInfosoft    -> espelho no ERP (cancela e recria a autorização).
      if (dataAlterada && updates.Data && event.Data) {
        const mudancas = [{ de: event.Data, para: updates.Data }, ...mudancasFuturas];
        if (cfg?.webhookTodosEventos) {
          firePainelWebhook(cfg?.webhookAgendamento, {
            evento: "agendamento_reagendado",
            unidade: unit.slug,
            canal: event.Canal,
            nome: event.Nome,
            telefone: event["Número"],
            mudancas,
            tipo: tipo || null,
            procedimento: procedimento || null,
          });
        }
        firePainelWebhook(cfg?.webhookInfosoft, {
          evento: "agendamento_reagendado",
          unidade: unit.slug,
          nome: event.Nome,
          telefone: event["Número"],
          mudancas,
          tipo: tipo || null,
          procedimento: procedimento || null,
          responsavel: respAtendimento || null,
          cpf: event.CPF,
          nascimento: event.Nascimento,
          sexo: event.Sexo,
          email: event.Email,
        });
      }
    } catch (e: any) {
      if (e?.code === "23505") {
        toast.error("Já existe uma sessão desse paciente nesse dia e horário");
      } else {
        toast.error("Erro ao salvar" + (e?.message ? ": " + e.message : ""));
      }
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(event.id);
      // Exclusão notifica o n8n da unidade (só rollout — webhookTodosEventos) e
      // o espelho Infosoft, que cancela a autorização vinculada; o vínculo mora
      // na tabela-espelho do n8n, então funciona mesmo com a linha já apagada.
      if (cfg?.webhookTodosEventos) {
        firePainelWebhook(cfg?.webhookAgendamento, {
          evento: "agendamento_excluido",
          unidade: unit.slug,
          canal: event.Canal,
          nome: event.Nome,
          telefone: event["Número"],
          data: event.Data,
        });
      }
      firePainelWebhook(cfg?.webhookInfosoft, {
        evento: "agendamento_excluido",
        unidade: unit.slug,
        nome: event.Nome,
        telefone: event["Número"],
        data: event.Data,
      });
      toast.success("Agendamento excluído");
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error("Erro ao excluir" + (msg ? ": " + msg : ""));
    }
  };

  const handleDeleteFuturas = async () => {
    try {
      const n = await deleteFuturasMutation.mutateAsync(futurasDoPaciente.map((f) => f.id));
      // Um evento por sessão excluída — é por (Número, Data) que o n8n acha a
      // linha (e o espelho acha cada autorização no ERP).
      for (const f of futurasDoPaciente) {
        if (cfg?.webhookTodosEventos) {
          firePainelWebhook(cfg?.webhookAgendamento, {
            evento: "agendamento_excluido",
            unidade: unit.slug,
            canal: f.Canal,
            nome: f.Nome,
            telefone: f["Número"],
            data: f.Data,
          });
        }
        firePainelWebhook(cfg?.webhookInfosoft, {
          evento: "agendamento_excluido",
          unidade: unit.slug,
          nome: f.Nome,
          telefone: f["Número"],
          data: f.Data,
        });
      }
      toast.success(`${n} ${n === 1 ? "agendamento futuro excluído" : "agendamentos futuros excluídos"}`);
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error("Erro ao excluir" + (msg ? ": " + msg : ""));
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
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${TONE_CHIP_STRONG[status.tone]}`}>
            <StatusIcon className="h-4 w-4" />
            <span className="text-sm font-semibold">{status.label}</span>
          </div>

          {/* Resultado do espelho no ilife (unidades com config.infosoft) — a
              atendente precisa VER quando o ERP recusou, senão acha que entrou. */}
          {cfg?.infosoft && (() => {
            const s = event.infosoft_status ?? "";
            const cls = s.startsWith("OK")
              ? "border-green-500/40 bg-green-500/10 text-green-500"
              : s.startsWith("ERRO")
                ? "border-red-500/40 bg-red-500/10 text-red-500"
                : s.startsWith("PENDENTE")
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
                  : "border-border bg-muted/40 text-muted-foreground";
            const label = s.startsWith("OK")
              ? "Infosoft: agendado ✓"
              : s.startsWith("ERRO")
                ? `Infosoft: NÃO agendado — ${s.replace(/^ERRO:?\s*/, "")}`
                : s.startsWith("PENDENTE")
                  ? "Infosoft: pendente — faltou dado de cadastro"
                  : "Infosoft: aguardando espelho…";
            return <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${cls}`}>{label}</div>;
          })()}

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

          {!cfg?.editarData ? (
            <div className="glass-card rounded-xl p-3">
              <div className="mb-1 flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Data</span>
              </div>
              <p className="text-sm font-bold capitalize text-foreground">
                {parsedDate ? format(parsedDate, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR }) : "Data inválida"}
              </p>
            </div>
          ) : (
            <div className="glass-card rounded-xl p-3">
              <div className="mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Data e horário</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={dataEdit}
                  onChange={(e) => setDataEdit(e.target.value)}
                  className="border-border bg-secondary/50"
                />
                <Input
                  type="time"
                  value={horaEdit}
                  onChange={(e) => setHoraEdit(e.target.value)}
                  className="border-border bg-secondary/50"
                />
              </div>
              {dataAlterada && sessoesFuturas.length > 0 && (
                <label className="mt-2.5 flex cursor-pointer items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                  <Checkbox
                    checked={aplicarFuturas}
                    onCheckedChange={(v) => setAplicarFuturas(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-xs text-muted-foreground">
                    Aplicar também às{" "}
                    <span className="font-semibold text-foreground">{sessoesFuturas.length}</span>{" "}
                    {sessoesFuturas.length === 1 ? "sessão futura" : "sessões futuras"} deste paciente no mesmo dia e horário
                    (muda o dia da semana e o horário, mantendo cada sessão na própria semana).
                  </span>
                </label>
              )}
              {dataAlterada && (
                <p className="mt-2 text-[11px] text-primary">
                  A alteração só é gravada ao clicar em "Salvar alterações".
                </p>
              )}
            </div>
          )}

          {/* Registro de presença/falta (unidades com config.presenca) */}
          {cfg?.presenca && (
            <div className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3">
              <Label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <UserCheck className="h-3.5 w-3.5 text-green-400" /> Comparecimento
              </Label>
              <Segmented value={presenca} options={presencaOptions} onChange={setPresenca} />
              {presenca === PRESENCA.FALTOU_JUSTIFICADA && (
                <Textarea
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  placeholder="Justificativa da falta..."
                  className="mt-1 min-h-[60px] resize-none border-border bg-secondary/50 text-foreground"
                />
              )}
            </div>
          )}

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
                <ClipboardList className="h-3.5 w-3.5 text-green-400" /> Categoria
              </Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="border-border bg-secondary/50">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Paciente agendou? + Origem (unidades com config.agendou / config.origem) */}
          {(cfg?.agendou || cfg?.origem) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {cfg?.agendou && (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <CalendarCheck className="h-3.5 w-3.5 text-green-400" /> Paciente agendou?
                  </Label>
                  <Segmented value={agendou} options={agendouOptions} onChange={setAgendou} />
                </div>
              )}
              {cfg?.origem && (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Building2 className="h-3.5 w-3.5 text-green-400" /> Origem do paciente
                  </Label>
                  <Select value={origem} onValueChange={setOrigem}>
                    <SelectTrigger className="border-border bg-secondary/50">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ORIGEM_OPCOES.map((o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

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
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending || reagendarMutation.isPending}
              className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90"
            >
              <Save className="mr-2 h-4 w-4" />
              {updateMutation.isPending || reagendarMutation.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>

          {(cfg?.excluir || (cfg?.excluirFuturos && futurasDoPaciente.length > 0)) && (
            <div className="space-y-1 border-t border-border pt-3">
              {cfg?.excluir && (!confirmDelete ? (
                <Button
                  variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir agendamento
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-xs text-muted-foreground">Excluir este agendamento? Não dá pra desfazer.</span>
                  <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
                  <Button
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
                  </Button>
                </div>
              ))}
              {cfg?.excluirFuturos && futurasDoPaciente.length > 0 && (!confirmDeleteFuturas ? (
                <Button
                  variant="ghost"
                  onClick={() => setConfirmDeleteFuturas(true)}
                  className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <CalendarX className="mr-2 h-4 w-4" /> Excluir todos os futuros deste paciente ({futurasDoPaciente.length})
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-xs text-muted-foreground">
                    Excluir {futurasDoPaciente.length === 1 ? "o agendamento futuro" : `os ${futurasDoPaciente.length} agendamentos futuros`} de{" "}
                    {event.Nome || "este paciente"}? Não dá pra desfazer.
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setConfirmDeleteFuturas(false)}>Cancelar</Button>
                  <Button
                    size="sm"
                    onClick={handleDeleteFuturas}
                    disabled={deleteFuturasMutation.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteFuturasMutation.isPending ? "Excluindo..." : "Excluir todos"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
