// Status semântico de um agendamento — fonte ÚNICA da cadeia de prioridade.
// Os calendários (Day/Week/Month) e o modal derivam daqui, em vez de cada um
// reimplementar a lógica de "confirmado/cancelado/pendente".
//
// Campos customizados (só a Fisio Vida usa hoje, via config da unidade):
//   - Presenca      -> registro pós-atendimento (compareceu / faltou)
//   - Agendou       -> "Sim"/"Não": paciente confirmou o horário marcado
//   - Confirmação   -> coluna legada (Confirmado1) usada pelas demais unidades
import type { Agendamento } from "@/hooks/useAgendamentos";

// Valores canônicos gravados nas colunas customizadas.
export const AGENDOU = { SIM: "Sim", NAO: "Não" } as const;
export const ORIGEM = { CONVENIO: "Convênio", PARTICULAR: "Particular" } as const;
export const PRESENCA = {
  COMPARECEU: "Compareceu",
  FALTOU_JUSTIFICADA: "Faltou (justificada)",
  FALTOU_NAO_JUSTIFICADA: "Faltou (não justificada)",
} as const;

export const ORIGEM_OPCOES = [ORIGEM.CONVENIO, ORIGEM.PARTICULAR] as const;
export const PRESENCA_OPCOES = [
  PRESENCA.COMPARECEU,
  PRESENCA.FALTOU_JUSTIFICADA,
  PRESENCA.FALTOU_NAO_JUSTIFICADA,
] as const;

export type StatusKey =
  | "compareceu"
  | "faltou"
  | "cancelado"
  | "confirmado"
  | "reagendado"
  | "pendente"
  | "custom";

export type StatusTone = "success" | "danger" | "warning" | "primary" | "muted";

export interface DerivedStatus {
  key: StatusKey;
  tone: StatusTone;
  label: string;
}

const TONE_BY_KEY: Record<StatusKey, StatusTone> = {
  compareceu: "success",
  confirmado: "success",
  faltou: "danger",
  cancelado: "danger",
  reagendado: "warning",
  custom: "primary",
  pendente: "muted",
};

// Cadeia de prioridade: Presença (o que de fato aconteceu) vence Agendou
// (confirmação prévia), que vence a Confirmação legada, que vence Pendente.
export function deriveStatus(
  event: Pick<Agendamento, "Presenca" | "Agendou" | "Confirmação">,
): DerivedStatus {
  const withTone = (key: StatusKey, label: string): DerivedStatus => ({ key, tone: TONE_BY_KEY[key], label });

  const presenca = (event.Presenca ?? "").trim();
  const p = presenca.toLowerCase();
  if (p.includes("compareceu")) return withTone("compareceu", PRESENCA.COMPARECEU);
  if (p.includes("faltou") || p.includes("falta")) return withTone("faltou", presenca || "Faltou");

  const agendou = (event.Agendou ?? "").trim().toLowerCase();
  if (agendou === "sim") return withTone("confirmado", "Confirmado");
  if (agendou === "não" || agendou === "nao") return withTone("pendente", "Não confirmado");

  const conf = (event["Confirmação"] ?? "").trim();
  if (!conf) return withTone("pendente", "Pendente");
  const c = conf.toLowerCase();
  if (c.includes("confirm") || c.includes("ok")) return withTone("confirmado", "Confirmado");
  if (c.includes("cancel") || c.includes("desmarc")) return withTone("cancelado", conf);
  if (c.includes("reagend")) return withTone("reagendado", conf);
  return withTone("custom", conf);
}

// Classes Tailwind por tom, em três "formatos" que os componentes consomem.
export const TONE_BORDER: Record<StatusTone, string> = {
  success: "border-green-400/50",
  danger: "border-destructive/50",
  warning: "border-amber-400/50",
  primary: "border-primary/40",
  muted: "border-green-300/40",
};

export const TONE_CHIP: Record<StatusTone, string> = {
  success: "bg-green-400/12 text-green-500",
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-amber-400/12 text-amber-500",
  primary: "bg-primary/12 text-primary",
  muted: "bg-muted text-muted-foreground",
};

// Heurística NÃO-destrutiva: sugere a origem a partir do procedimento quando o
// campo ainda está vazio. Só pré-preenche o formulário — nunca grava sozinho.
// Convênio: procedimentos com prefixo C-/BC/AFISVEC ou código de convênio 2010….
export function guessOrigem(procedimento: string | null | undefined): string | null {
  if (!procedimento) return null;
  const s = procedimento.trim().toUpperCase();
  if (/^(C-|BC|AFISVEC)/.test(s) || /\b2010\d{4}\b/.test(s) || /\b5000\d{4}\b/.test(s)) {
    return ORIGEM.CONVENIO;
  }
  return null;
}
