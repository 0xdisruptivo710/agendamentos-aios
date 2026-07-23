import { useMemo, useState } from "react";
import { addDays, addMonths, addWeeks, isToday, subDays, subMonths, subWeeks } from "date-fns";
import { motion } from "framer-motion";
import { AlertCircle, BarChart3, CalendarDays, CheckCircle, Loader2, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarHeader } from "@/components/calendar/CalendarHeader";
import { CreateAppointmentDialog } from "@/components/calendar/CreateAppointmentDialog";
import { DayView } from "@/components/calendar/DayView";
import { EventDetailDialog, type EventSuggestions } from "@/components/calendar/EventDetailDialog";
import { MonthView } from "@/components/calendar/MonthView";
import { ReportsView } from "@/components/calendar/ReportsView";
import { UpcomingAppointmentsPanel } from "@/components/calendar/UpcomingAppointmentsPanel";
import { WeekView } from "@/components/calendar/WeekView";
import { useAgendamentos, type Agendamento } from "@/hooks/useAgendamentos";
import { useAtendentes } from "@/hooks/useAtendentes";

function distinct(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v && v.trim() !== "")))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

const UnitPanel = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [selectedEvent, setSelectedEvent] = useState<Agendamento | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("agenda");
  const { data: agendamentos, isLoading, isError, error } = useAgendamentos();
  const { data: atendentes } = useAtendentes();

  const handlePrev = () => {
    if (view === "month") setCurrentDate((d) => subMonths(d, 1));
    else if (view === "week") setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subDays(d, 1));
  };

  const handleNext = () => {
    if (view === "month") setCurrentDate((d) => addMonths(d, 1));
    else if (view === "week") setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addDays(d, 1));
  };

  const handleEventClick = (event: Agendamento) => {
    setSelectedEvent(event);
    if (event.parsedDate) setCurrentDate(event.parsedDate);
    setDialogOpen(true);
  };

  // Atendentes cadastrados (tabela painel_atendentes) entram como opção no
  // dropdown de responsável, mesmo antes de terem qualquer agendamento.
  const atendenteNomes = useMemo(() => (atendentes ?? []).map((a) => a.nome), [atendentes]);

  const suggestions: EventSuggestions = useMemo(() => ({
    respAgendamento: distinct([...(agendamentos ?? []).map((a) => a.Responsavel_Agendamento), ...atendenteNomes]),
    respAtendimento: distinct([...(agendamentos ?? []).map((a) => a.Responsavel_Atendimento), ...atendenteNomes]),
    procedimento: distinct((agendamentos ?? []).map((a) => a.Procedimento)),
  }), [agendamentos, atendenteNomes]);

  const stats = useMemo(() => {
    if (!agendamentos) return { total: 0, today: 0, confirmed: 0, pending: 0 };

    const today = agendamentos.filter((a) => (a.parsedDate ? isToday(a.parsedDate) : false));
    const confirmed = agendamentos.filter((a) => {
      const s = a.Confirmação?.toLowerCase() || "";
      return s.includes("confirm") || s.includes("ok");
    });
    const pending = agendamentos.filter((a) => !a.Confirmação);

    return { total: agendamentos.length, today: today.length, confirmed: confirmed.length, pending: pending.length };
  }, [agendamentos]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {isError && (
          <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Erro ao carregar agendamentos: {(error as any)?.message || "verifique a conexão / permissões da tabela."}
          </div>
        )}

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Total", value: stats.total, icon: CalendarDays, color: "text-primary", bg: "bg-secondary" },
            { label: "Hoje", value: stats.today, icon: Users, color: "text-primary", bg: "bg-secondary" },
            { label: "Confirmados", value: stats.confirmed, icon: CheckCircle, color: "text-primary", bg: "bg-secondary" },
            { label: "Pendentes", value: stats.pending, icon: AlertCircle, color: "text-muted-foreground", bg: "bg-muted" },
          ].map((stat) => (
            <div key={stat.label} className="glass-card flex items-center gap-3 rounded-xl px-5 py-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
              </div>
            </div>
          ))}
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="h-auto gap-1 bg-card border border-border rounded-full p-1">
              <TabsTrigger
                value="agenda"
                className="rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground data-[state=active]:bg-secondary data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                <CalendarDays className="mr-2 h-4 w-4" /> Agenda
              </TabsTrigger>
              <TabsTrigger
                value="reports"
                className="rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground data-[state=active]:bg-secondary data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                <BarChart3 className="mr-2 h-4 w-4" /> Relatórios
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="agenda" className="space-y-6 mt-0">
            <CalendarHeader
              currentDate={currentDate}
              view={view}
              onPrev={handlePrev}
              onNext={handleNext}
              onToday={() => setCurrentDate(new Date())}
              onViewChange={setView}
              onCreate={() => setCreateOpen(true)}
            />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <motion.div key={`${view}-${currentDate.toISOString()}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                {view === "month" && <MonthView currentDate={currentDate} agendamentos={agendamentos || []} onEventClick={handleEventClick} onDayClick={(date) => { setCurrentDate(date); setView("day"); }} />}
                {view === "week" && <WeekView currentDate={currentDate} agendamentos={agendamentos || []} onEventClick={handleEventClick} />}
                {view === "day" && <DayView currentDate={currentDate} agendamentos={agendamentos || []} onEventClick={handleEventClick} />}
              </motion.div>

              <UpcomingAppointmentsPanel agendamentos={agendamentos || []} onEventClick={handleEventClick} />
            </div>
          </TabsContent>

          <TabsContent value="reports" className="mt-0">
            <ReportsView agendamentos={agendamentos || []} />
          </TabsContent>
        </Tabs>

        <EventDetailDialog event={selectedEvent} open={dialogOpen} onOpenChange={setDialogOpen} suggestions={suggestions} />
        <CreateAppointmentDialog open={createOpen} onOpenChange={setCreateOpen} suggestions={suggestions} />
      </div>
    </div>
  );
};

export default UnitPanel;
