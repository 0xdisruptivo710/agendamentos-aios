// Ficha por paciente na aba Relatórios (config.relatorioPaciente).
//
// Pedido da Nice (Fisio Vida, 09/11/2026): "onde eu vejo os atendimentos que
// foram feitos na agenda, de cada paciente: o número de sessões que ele fez no
// mês, as faltas, os dias que ele avisou/cancelou e as etiquetas (convênio ou
// particular, os outros serviços)". Tudo sai da própria agenda; o convênio vem
// da mesma derivação da aba (derivarConvenios), então os números batem.
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, UserSearch, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Agendamento } from "@/hooks/useAgendamentos";
import { useUnit } from "@/context/UnitContext";
import { PRESENCA } from "@/lib/agendamento-status";
import { derivarConvenios } from "@/lib/convenio";
import { normalizarTexto } from "@/lib/profissional-cores";

interface Paciente {
  chave: string;
  nome: string;
  telefone: string;
  total: number;
}

const soDigitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
// Mesmo paciente = mesmo telefone; sem telefone, o nome normalizado.
const chavePaciente = (a: Agendamento) => soDigitos(a["Número"]).slice(-11) || `nome:${normalizarTexto(a.Nome ?? "")}`;

function situacao(a: Agendamento, agora: Date): { texto: string; cls: string } {
  const p = (a.Presenca ?? "").trim();
  if (p === PRESENCA.COMPARECEU) return { texto: "Compareceu", cls: "text-green-700" };
  if (p === PRESENCA.FALTOU_JUSTIFICADA) return { texto: "Faltou (justificada)", cls: "text-amber-700" };
  if (p === PRESENCA.FALTOU_NAO_JUSTIFICADA) return { texto: "Faltou (não justificada)", cls: "text-red-600" };
  if ((a.Cancelamento ?? "").trim()) return { texto: "Avisou / desmarcou", cls: "text-purple-700" };
  if (a.parsedDate && a.parsedDate > agora) return { texto: "Agendada", cls: "text-muted-foreground" };
  return { texto: "Sem registro de presença", cls: "text-muted-foreground" };
}

export function PatientReport({ agendamentos }: { agendamentos: Agendamento[] }) {
  const cfg = useUnit().config;
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [mes, setMes] = useState(() => format(new Date(), "yyyy-MM")); // "" = todo o período

  const convenios = useMemo(() => derivarConvenios(agendamentos, cfg?.convenios), [agendamentos, cfg?.convenios]);

  const pacientes = useMemo(() => {
    const m = new Map<string, Paciente>();
    for (const a of agendamentos) {
      const k = chavePaciente(a);
      if (k === "nome:") continue;
      const p = m.get(k) ?? { chave: k, nome: (a.Nome ?? "").trim(), telefone: soDigitos(a["Número"]), total: 0 };
      p.total++;
      m.set(k, p);
    }
    return [...m.values()];
  }, [agendamentos]);

  const sugestoes = useMemo(() => {
    const q = busca.trim();
    if (q.length < 2) return [];
    const qn = normalizarTexto(q);
    const qd = q.replace(/\D/g, "");
    return pacientes
      .filter((p) => (qd.length >= 4 ? p.telefone.includes(qd) : normalizarTexto(p.nome).includes(qn)))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .slice(0, 8);
  }, [busca, pacientes]);

  const paciente = escolhido ? pacientes.find((p) => p.chave === escolhido) ?? null : null;

  const sessoes = useMemo(() => {
    if (!paciente) return [];
    return agendamentos
      .filter((a) => chavePaciente(a) === paciente.chave)
      .filter((a) => !mes || (a.dayKey ?? "").startsWith(mes))
      .sort((a, b) => (a.parsedDate?.getTime() ?? 0) - (b.parsedDate?.getTime() ?? 0));
  }, [agendamentos, paciente, mes]);

  const agora = new Date();
  const resumo = useMemo(() => {
    const r = { agendadas: sessoes.length, compareceu: 0, justificada: 0, naoJustificada: 0, avisos: 0 };
    for (const a of sessoes) {
      const p = (a.Presenca ?? "").trim();
      if (p === PRESENCA.COMPARECEU) r.compareceu++;
      else if (p === PRESENCA.FALTOU_JUSTIFICADA) r.justificada++;
      else if (p === PRESENCA.FALTOU_NAO_JUSTIFICADA) r.naoJustificada++;
      if ((a.Cancelamento ?? "").trim()) r.avisos++;
    }
    return r;
  }, [sessoes]);

  // "Etiquetas" da ficha: convênio, serviços (categoria) e profissionais do paciente
  // em TODO o histórico, para a ficha não ficar vazia num mês sem sessão.
  const etiquetas = useMemo(() => {
    if (!paciente) return { convenio: [] as string[], servicos: [] as string[], profissionais: [] as string[] };
    const todas = agendamentos.filter((a) => chavePaciente(a) === paciente.chave);
    const uniq = (xs: (string | null | undefined)[]) =>
      [...new Set(xs.map((x) => (x ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return {
      convenio: uniq(todas.map((a) => convenios.get(a.id))),
      servicos: uniq(todas.map((a) => a.Tipo)),
      profissionais: uniq(todas.map((a) => a.Responsavel_Atendimento)),
    };
  }, [agendamentos, paciente, convenios]);

  const fone = paciente?.telefone
    ? paciente.telefone.replace(/^55(\d\d)(\d{4,5})(\d{4})$/, "($1) $2-$3")
    : "sem telefone";

  return (
    <div className="glass-card space-y-4 rounded-xl p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-2">
          <UserSearch className="h-5 w-5 text-primary" />
          <h3 className="text-base font-medium text-foreground">Ficha do paciente</h3>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative w-80 max-w-full space-y-1">
            <Label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Paciente</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome ou telefone..."
                className="border-border bg-card pl-9 pr-8"
              />
              {(busca || escolhido) && (
                <button
                  type="button"
                  onClick={() => { setBusca(""); setEscolhido(null); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpar paciente"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {sugestoes.length > 0 && !paciente && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                {sugestoes.map((p) => (
                  <button
                    key={p.chave}
                    type="button"
                    onClick={() => { setEscolhido(p.chave); setBusca(p.nome); }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary"
                  >
                    <span className="truncate">{p.nome}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">{p.total} sessões</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Mês (vazio = tudo)</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="border-border bg-card" />
          </div>
        </div>
      </div>

      {!paciente ? (
        <p className="text-sm text-muted-foreground">
          Digite o nome ou o telefone e escolha o paciente para ver as sessões, faltas e avisos dele.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-foreground">{paciente.nome}</span>
            <span className="text-muted-foreground">{fone}</span>
            {etiquetas.convenio.map((c) => (
              <span key={c} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">{c}</span>
            ))}
            {etiquetas.servicos.map((s) => (
              <span key={s} className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-semibold text-foreground">{s}</span>
            ))}
          </div>
          {etiquetas.profissionais.length > 0 && (
            <p className="text-xs text-muted-foreground">Profissionais: {etiquetas.profissionais.join(", ")}</p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["Sessões agendadas", resumo.agendadas],
              ["Compareceu", resumo.compareceu],
              ["Faltas justificadas", resumo.justificada],
              ["Faltas não justificadas", resumo.naoJustificada],
              ["Avisou / desmarcou", resumo.avisos],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded-xl border border-border bg-card p-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{rotulo}</p>
                <p className="text-xl font-semibold text-foreground">{valor}</p>
              </div>
            ))}
          </div>

          {sessoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma sessão {mes ? "neste mês" : "registrada"}.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessoes.map((a) => {
                  const s = situacao(a, agora);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap">
                        {a.parsedDate ? format(a.parsedDate, "EEE dd/MM/yyyy HH:mm", { locale: ptBR }) : a.Data}
                      </TableCell>
                      <TableCell>{a.Tipo || "-"}</TableCell>
                      <TableCell>{a.Responsavel_Atendimento || "-"}</TableCell>
                      <TableCell className={`font-medium ${s.cls}`}>{s.texto}</TableCell>
                      <TableCell className="max-w-xs text-xs text-muted-foreground">
                        {[a.Cancelamento, a.Justificativa].filter((x) => (x ?? "").trim()).join(" · ") || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
