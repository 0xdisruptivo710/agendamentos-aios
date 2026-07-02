import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarDays, ArrowRight } from "lucide-react";
import { UNITS } from "@/config/units";

const Landing = () => {
  const units = [...UNITS].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
            <CalendarDays className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Painéis de Agendamento</h1>
            <p className="text-sm text-muted-foreground">{units.length} unidades · selecione uma para abrir a agenda</p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {units.map((unit) => (
            <Link
              key={unit.slug}
              to={`/${unit.slug}`}
              className="glass-card group flex items-center justify-between rounded-xl px-5 py-4 transition-colors hover:bg-secondary/50"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">{unit.label}</p>
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">/{unit.slug}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default Landing;
