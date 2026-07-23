import { ChevronLeft, ChevronRight, Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUnit } from "@/context/UnitContext";

interface CalendarHeaderProps {
  currentDate: Date;
  view: "month" | "week" | "day";
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: "month" | "week" | "day") => void;
  onCreate?: () => void;
}

export function CalendarHeader({ currentDate, view, onPrev, onNext, onToday, onViewChange, onCreate }: CalendarHeaderProps) {
  const unit = useUnit();
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Painel Agendamento</h1>
        </div>
        <span className="hidden sm:inline text-sm text-muted-foreground">·</span>
        <span className="hidden sm:inline text-sm font-medium text-muted-foreground">{unit.label}</span>
        <h2 className="basis-full sm:basis-auto text-base font-medium text-muted-foreground capitalize">
          {format(currentDate, view === "day" ? "dd 'de' MMMM, yyyy" : "MMMM yyyy", { locale: ptBR })}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        {unit.config?.criar && onCreate && (
          <Button
            size="sm"
            onClick={onCreate}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Novo agendamento
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onToday}
        >
          Hoje
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrev}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
          {(["month", "week", "day"] as const).map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
                view === v
                  ? "bg-secondary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "month" ? "Mês" : v === "week" ? "Semana" : "Dia"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
