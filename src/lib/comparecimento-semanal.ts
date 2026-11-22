// Fechamento SEMANAL de compareceu x faltou — pedido do dono da clínica em
// 19/11/2026 ("quero ver por semana quem compareceu e quem faltou, e o que
// fazer com quem faltou").
//
// Regras que fazem o número ser honesto:
//   - semana de segunda a domingo (a clínica abre seg-sáb);
//   - cancelado NÃO entra: não era consulta para acontecer;
//   - consulta FUTURA entra em `consultas`, mas fica fora da taxa — senão a
//     semana corrente nasce com taxa baixa só porque ainda não aconteceu;
//   - `semRegistro` é o passado sem presença: é a dívida da recepção, e aparece
//     na tabela justamente para não ser confundida com falta.
import { addDays, format, startOfDay } from "date-fns";

export interface LinhaSemana {
  inicio: Date;
  fim: Date;        // domingo (inclusive)
  label: string;    // "17/11 a 23/11"
  consultas: number;
  compareceu: number;
  faltou: number;
  semRegistro: number;
  aAcontecer: number;
  taxa: number | null; // % de comparecimento entre as resolvidas; null = nada resolvido
}

export interface AgendamentoSemana {
  parsedDate?: Date | null;
  Presenca?: string | null;
  Cancelamento?: string | null;
}

// Segunda-feira da semana da data (não usa locale: a semana da clínica é
// sempre seg-dom, independente do locale do navegador).
export function segundaDa(d: Date): Date {
  const base = startOfDay(d);
  const dow = base.getDay();            // 0 = domingo
  return addDays(base, dow === 0 ? -6 : 1 - dow);
}

const FOLGA_MS = 60 * 60 * 1000;

export function resumoSemanal(
  agendamentos: AgendamentoSemana[],
  range: { start: Date; end: Date },
  now: Date = new Date(),
): LinhaSemana[] {
  const semanas = new Map<number, LinhaSemana>();
  const primeira = segundaDa(range.start);
  const ultima = segundaDa(range.end);
  for (let d = primeira; d.getTime() <= ultima.getTime(); d = addDays(d, 7)) {
    const fim = addDays(d, 6);
    semanas.set(d.getTime(), {
      inicio: d,
      fim,
      label: `${format(d, "dd/MM")} a ${format(fim, "dd/MM")}`,
      consultas: 0, compareceu: 0, faltou: 0, semRegistro: 0, aAcontecer: 0, taxa: null,
    });
  }

  for (const a of agendamentos) {
    const d = a.parsedDate;
    if (!d) continue;
    if ((a.Cancelamento ?? "").trim()) continue;
    const linha = semanas.get(segundaDa(d).getTime());
    if (!linha) continue;
    linha.consultas++;
    const p = (a.Presenca ?? "").toLowerCase();
    if (p.includes("compareceu")) linha.compareceu++;
    else if (p.includes("falt")) linha.faltou++;
    else if (now.getTime() - d.getTime() >= FOLGA_MS) linha.semRegistro++;
    else linha.aAcontecer++;
  }

  const saida = Array.from(semanas.values());
  for (const l of saida) {
    const resolvidas = l.compareceu + l.faltou;
    l.taxa = resolvidas > 0 ? (l.compareceu / resolvidas) * 100 : null;
  }
  // Mais recente primeiro: é a semana que a clínica quer ver ao abrir.
  return saida.sort((a, b) => b.inicio.getTime() - a.inicio.getTime());
}

export function semanalParaCsv(linhas: LinhaSemana[]): string {
  const head = "Semana;Consultas;Compareceu;Faltou;Sem registro;A acontecer;Taxa de comparecimento";
  const corpo = linhas.map((l) =>
    [l.label, l.consultas, l.compareceu, l.faltou, l.semRegistro, l.aAcontecer,
     l.taxa == null ? "" : l.taxa.toFixed(1).replace(".", ",") + "%"].join(";"),
  );
  return [head, ...corpo].join("\n");
}
