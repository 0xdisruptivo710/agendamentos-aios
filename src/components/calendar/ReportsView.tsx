import { useMemo, useState } from "react";
import { eachDayOfInterval, format, isSameDay, isWithinInterval, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from "recharts";
import {
  DollarSign, TrendingUp, UserCog, Stethoscope, ClipboardList,
  CalendarRange, Target, BadgePercent, Sparkles, AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Agendamento } from "@/hooks/useAgendamentos";
import { parseAgendamentoDate } from "@/lib/agendamento-date";

interface ReportsViewProps {
  agendamentos: Agendamento[];
}

const CHART_COLORS = ["#4F46E5", "#7C7BE8", "#A5A1F0", "#3B82F6", "#06B6D4", "#9333EA", "#EC4899"];
const PRIMARY = "hsl(245 75% 59%)";
const PRIMARY_SOFT = "hsl(244 90% 96%)";

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(v: number) {
  return `${v.toFixed(1).replace(".", ",")}%`;
}

function countBy<T>(arr: T[], key: (i: T) => string | null | undefined) {
  const map = new Map<string, number>();
  for (const item of arr) {
    const k = key(item);
    if (!k) continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

function sumBy<T>(arr: T[], key: (i: T) => string | null | undefined, val: (i: T) => number) {
  const map = new Map<string, number>();
  for (const item of arr) {
    const k = key(item);
    if (!k) continue;
    const v = val(item);
    if (!v) continue;
    map.set(k, (map.get(k) || 0) + v);
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

export function ReportsView({ agendamentos }: ReportsViewProps) {
  const [from, setFrom] = useState<string>(() => format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [to, setTo] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const [selectedDay, setSelectedDay] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));

  const range = useMemo(() => ({
    start: startOfDay(new Date(`${from}T00:00:00`)),
    end: endOfDay(new Date(`${to}T00:00:00`)),
  }), [from, to]);

  const filtered = useMemo(() => {
    return agendamentos.filter((a) => {
      const d = parseAgendamentoDate(a.Data);
      return d ? isWithinInterval(d, range) : false;
    });
  }, [agendamentos, range]);

  // KPIs corrigidos
  const comVenda = useMemo(
    () => filtered.filter((a) => Number(a.Valor) > 0),
    [filtered],
  );
  const totalAgendamentos = filtered.length;
  const totalComVenda = comVenda.length;
  const faturamento = comVenda.reduce((acc, a) => acc + Number(a.Valor || 0), 0);
  const ticketMedio = totalComVenda > 0 ? faturamento / totalComVenda : 0;
  const conversao = totalAgendamentos > 0 ? (totalComVenda / totalAgendamentos) * 100 : 0;

  // Análise por dia
  const dayDate = useMemo(() => new Date(`${selectedDay}T00:00:00`), [selectedDay]);
  const dayInsideRange = isWithinInterval(dayDate, range);
  const doDia = useMemo(
    () => agendamentos.filter((a) => {
      const d = parseAgendamentoDate(a.Data);
      return d ? isSameDay(d, dayDate) : false;
    }),
    [agendamentos, dayDate],
  );
  const doDiaComVenda = doDia.filter((a) => Number(a.Valor) > 0);
  const faturamentoDoDia = doDiaComVenda.reduce((acc, a) => acc + Number(a.Valor || 0), 0);
  const ticketMedioDoDia = doDiaComVenda.length > 0 ? faturamentoDoDia / doDiaComVenda.length : 0;

  // Charts
  const porAgendador = useMemo(
    () => countBy(filtered, (a) => a.Responsavel_Agendamento).sort((a, b) => b.value - a.value),
    [filtered],
  );
  const porAtendente = useMemo(
    () => countBy(filtered, (a) => a.Responsavel_Atendimento).sort((a, b) => b.value - a.value),
    [filtered],
  );
  const porTipo = useMemo(
    () => {
      const counts = countBy(filtered, (a) => a.Tipo);
      const semTipo = filtered.filter((a) => !a.Tipo).length;
      if (semTipo > 0) counts.push({ name: "Sem tipo", value: semTipo });
      return counts;
    },
    [filtered],
  );
  const vendasPorAtendente = useMemo(
    () => sumBy(filtered, (a) => a.Responsavel_Atendimento, (a) => Number(a.Valor) || 0)
      .sort((a, b) => b.value - a.value),
    [filtered],
  );
  const topProcedimentos = useMemo(
    () => countBy(filtered, (a) => a.Procedimento).sort((a, b) => b.value - a.value).slice(0, 8),
    [filtered],
  );

  // Faturamento ao longo do tempo (line chart por dia)
  const faturamentoTimeline = useMemo(() => {
    if (range.start > range.end) return [];
    const days = eachDayOfInterval({ start: range.start, end: range.end });
    return days.map((day) => {
      const total = filtered
        .filter((a) => {
          const d = parseAgendamentoDate(a.Data);
          return d ? isSameDay(d, day) && Number(a.Valor) > 0 : false;
        })
        .reduce((acc, a) => acc + Number(a.Valor || 0), 0);
      return { name: format(day, "dd/MM"), value: total };
    });
  }, [filtered, range]);

  const setRange = (days: number) => {
    setFrom(format(subDays(new Date(), days), "yyyy-MM-dd"));
    setTo(format(new Date(), "yyyy-MM-dd"));
  };

  const kpis = [
    { label: "Faturamento", value: formatCurrency(faturamento), icon: DollarSign },
    { label: "Atendimentos", value: totalAgendamentos, icon: ClipboardList },
    { label: "Com venda", value: totalComVenda, icon: Sparkles },
    { label: "Conversão", value: formatPercent(conversao), icon: BadgePercent },
    { label: "Ticket médio", value: formatCurrency(ticketMedio), icon: TrendingUp },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Filtros */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-primary" />
            <h3 className="text-base font-medium text-foreground">Período</h3>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">De</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border-border bg-card" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Até</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border-border bg-card" />
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setRange(7)}>7d</Button>
              <Button variant="outline" size="sm" onClick={() => setRange(30)}>30d</Button>
              <Button variant="outline" size="sm" onClick={() => setRange(90)}>90d</Button>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map((s) => (
          <div key={s.label} className="glass-card flex items-center gap-3 rounded-xl px-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <s.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{s.label}</p>
              <p className="truncate text-xl font-semibold text-foreground">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Faturamento ao longo do tempo */}
      <div className="glass-card rounded-xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-medium text-foreground">Faturamento por dia</h4>
        </div>
        {faturamento === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Nenhuma venda registrada no período</div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={faturamentoTimeline} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number) => formatCurrency(v)}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Line type="monotone" dataKey="value" stroke={PRIMARY} strokeWidth={2.5} dot={{ fill: PRIMARY, r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Análise por dia */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Análise por dia</p>
            <h3 className="mt-1 text-base font-medium text-foreground capitalize">
              {format(dayDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </h3>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Selecione o dia</Label>
            <Input type="date" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} className="border-border bg-card" />
          </div>
        </div>

        {!dayInsideRange && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              O dia selecionado está <strong>fora do período</strong> definido acima. Os números abaixo refletem só esse dia, independente do filtro.
            </span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <DayStat label="Atendimentos" value={doDia.length} />
          <DayStat label="Com venda" value={doDiaComVenda.length} highlight />
          <DayStat label="Faturamento" value={formatCurrency(faturamentoDoDia)} highlight />
          <DayStat label="Ticket médio" value={formatCurrency(ticketMedioDoDia)} highlight />
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Quem mais agendou"
          icon={UserCog}
          data={porAgendador}
          kind="bar"
          minVariation={2}
          emptyHint="Cadastre 2+ responsáveis pelo agendamento para ver a distribuição"
        />
        <ChartCard
          title="Atendimentos por responsável"
          icon={Stethoscope}
          data={porAtendente}
          kind="bar"
          minVariation={2}
          emptyHint="Cadastre 2+ responsáveis pelo atendimento para ver a distribuição"
        />
        <ChartCard
          title="Faturamento por responsável"
          icon={DollarSign}
          data={vendasPorAtendente}
          kind="bar"
          valueFormatter={formatCurrency}
          emptyHint="Nenhuma venda registrada no período"
        />
        <ChartCard
          title="Top procedimentos"
          icon={Sparkles}
          data={topProcedimentos}
          kind="bar"
          emptyHint="Nenhum agendamento com procedimento informado"
        />
        <ChartCard
          title="Distribuição por tipo"
          icon={ClipboardList}
          data={porTipo}
          kind="pie"
          minVariation={2}
          emptyHint="Preencha o campo 'Tipo' nos agendamentos para ver a distribuição"
        />
      </div>
    </motion.div>
  );
}

function DayStat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

interface ChartCardProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  data: { name: string; value: number }[];
  kind: "bar" | "pie";
  valueFormatter?: (v: number) => string;
  minVariation?: number;
  emptyHint?: string;
}

function ChartCard({ title, icon: Icon, data, kind, valueFormatter, minVariation = 1, emptyHint }: ChartCardProps) {
  const nonZero = data.filter((d) => d.value > 0);
  const hasMeaningfulData = nonZero.length >= minVariation;

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
      </div>
      {!hasMeaningfulData ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">
            {nonZero.length === 0 ? "Sem dados no período" : "Dados insuficientes para comparação"}
          </p>
          {emptyHint && <p className="max-w-xs text-xs text-muted-foreground/70">{emptyHint}</p>}
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {kind === "bar" ? (
              <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number) => (valueFormatter ? valueFormatter(v) : v)}
                  cursor={{ fill: PRIMARY_SOFT }}
                />
                <Bar dataKey="value" fill={PRIMARY} radius={[6, 6, 0, 0]} />
              </BarChart>
            ) : (
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" outerRadius={80} label={(p) => `${p.name} (${p.value})`}>
                  {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
