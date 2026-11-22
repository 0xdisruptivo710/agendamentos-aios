// Status semântico de um agendamento — fonte ÚNICA da cadeia de prioridade.
// Os calendários (Day/Week/Month) e o modal derivam daqui, em vez de cada um
// reimplementar a lógica de "confirmado/cancelado/pendente".
//
// Campos customizados (só a Fisio Vida usa hoje, via config da unidade):
//   - Presenca      -> registro pós-atendimento (compareceu / faltou)
//   - Agendou       -> "Sim"/"Não": paciente confirmou o horário marcado
//   - Confirmação   -> coluna legada (Confirmado1) usada pelas demais unidades

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
  | "faltou_justificada"
  | "cancelado"
  | "confirmado"
  | "reagendado"
  | "pendente"
  | "custom"
  // Fluxo de comparecimento (config.comparecimento):
  | "aguardando"   // o bot perguntou e o paciente ainda não respondeu
  | "a_marcar"     // a consulta passou e ninguém (bot nem recepção) registrou
  | "agendado";    // ainda vai acontecer

// "presente" é um tom à parte de propósito: o tema redireciona os tokens
// `green-*` para o roxo da marca (ver --green-400 em index.css), então o
// "success" das demais unidades sai ROXO — igual ao "Agendado". Para a agenda de
// comparecimento isso apagava justamente a distinção que o cliente pediu (quem
// veio x quem ainda vai vir), então o "Compareceu" usa `emerald`, que é verde de
// verdade. Só a cadeia de comparecimento devolve este tom; nenhuma outra unidade
// muda de cor.
export type StatusTone = "success" | "danger" | "warning" | "primary" | "muted" | "presente";

export interface DerivedStatus {
  key: StatusKey;
  tone: StatusTone;
  label: string;
}

const TONE_BY_KEY: Record<StatusKey, StatusTone> = {
  compareceu: "success",
  confirmado: "success",
  faltou: "danger",
  faltou_justificada: "warning",
  cancelado: "danger",
  reagendado: "warning",
  custom: "primary",
  pendente: "muted",
  // Âmbar = precisa de alguém da clínica; roxo = ainda vai acontecer. Assim a
  // agenda se lê pela cor: verde veio, vermelho faltou, âmbar é a sua vez,
  // roxo é futuro.
  aguardando: "warning",
  a_marcar: "warning",
  agendado: "primary",
};

// Legenda da agenda nas unidades com config.comparecimento. O Leo perguntou em
// 19/11 o que significava o chip da agenda: em vez de responder no grupo, a
// agenda explica sozinha.
export const LEGENDA_COMPARECIMENTO: { key: StatusKey; label: string; ajuda: string }[] = [
  { key: "compareceu", label: "Compareceu", ajuda: "o paciente respondeu que foi atendido, ou a recepção marcou" },
  { key: "faltou", label: "Faltou", ajuda: "o paciente respondeu que não foi, ou a recepção marcou a falta" },
  { key: "aguardando", label: "Aguardando resposta", ajuda: "o bot perguntou e o paciente ainda não respondeu" },
  { key: "a_marcar", label: "Marcar presença", ajuda: "a consulta passou e ninguém registrou ainda" },
  { key: "agendado", label: "Agendado", ajuda: "a consulta ainda vai acontecer" },
];

// Entrada do status: todos os campos OPCIONAIS, porque cada unidade tem um
// subconjunto deles (e os testes montam objetos parciais). `Agendamento`
// satisfaz este shape.
export interface StatusInput {
  Presenca?: string | null;
  Agendou?: string | null;
  "Confirmação"?: string | null;
  Cancelamento?: string | null;
  Comparecimento_Perguntado_Em?: string | null;
  parsedDate?: Date | null;
}

export interface StatusOptions {
  // Unidade com fluxo de comparecimento (config.comparecimento): a cadeia passa
  // a ser "o que aconteceu com o paciente" e NUNCA devolve Confirmado/Pendente.
  comparecimento?: boolean;
  now?: Date;
}

// Folga depois do horário: antes disso a consulta é "Agendado" (está
// acontecendo), não "Marcar presença". Mesma folga que o bot usa para perguntar.
const FOLGA_MS = 60 * 60 * 1000;

// Presença -> status; parte comum às duas cadeias. Devolve null quando a linha
// ainda não tem presença registrada. `rotuloCurto` = agenda de comparecimento,
// onde o chip diz só "Faltou" (o Leo pediu dois estados; justificada ou não é
// detalhe da ficha).
function statusDaPresenca(presencaRaw: string, rotuloCurto: boolean): DerivedStatus | null {
  const withTone = (key: StatusKey, label: string): DerivedStatus => ({ key, tone: TONE_BY_KEY[key], label });
  const presenca = presencaRaw.trim();
  const p = presenca.toLowerCase();
  if (p.includes("compareceu")) return withTone("compareceu", PRESENCA.COMPARECEU);
  if (p.includes("faltou") || p.includes("falta")) {
    // Justificada = âmbar, não justificada = vermelho: a recepção distingue na
    // agenda sem abrir o modal. "não justificada" também contém "justificada".
    const naoJustificada = /n[aã]o\s+justificad/.test(p);
    if (!naoJustificada && p.includes("justificad")) {
      return withTone("faltou_justificada", rotuloCurto ? "Faltou" : presenca);
    }
    return withTone("faltou", rotuloCurto ? "Faltou" : presenca || "Faltou");
  }
  return null;
}

// Cadeia do fluxo de comparecimento: presença > cancelamento > perguntado pelo
// bot > futuro > passou e ninguém marcou.
function statusComparecimento(event: StatusInput, now: Date): DerivedStatus {
  const withTone = (key: StatusKey, label: string): DerivedStatus => ({ key, tone: TONE_BY_KEY[key], label });

  const daPresenca = statusDaPresenca(event.Presenca ?? "", true);
  if (daPresenca) {
    return daPresenca.key === "compareceu" ? { ...daPresenca, tone: "presente" } : daPresenca;
  }

  // `Cancelamento` guarda o MOTIVO em texto livre (ou "" nas linhas antigas),
  // então qualquer texto = cancelado. O motivo aparece na ficha.
  if ((event.Cancelamento ?? "").trim()) return withTone("cancelado", "Cancelado");

  if ((event.Comparecimento_Perguntado_Em ?? "").trim()) return withTone("aguardando", "Aguardando resposta");

  const d = event.parsedDate;
  if (!d) return withTone("agendado", "Agendado");
  if (now.getTime() - d.getTime() < FOLGA_MS) return withTone("agendado", "Agendado");
  return withTone("a_marcar", "Marcar presença");
}

// Cadeia de prioridade: Presença (o que de fato aconteceu) vence Agendou
// (confirmação prévia), que vence a Confirmação legada, que vence Pendente.
export function deriveStatus(event: StatusInput, opts?: StatusOptions): DerivedStatus {
  const withTone = (key: StatusKey, label: string): DerivedStatus => ({ key, tone: TONE_BY_KEY[key], label });

  if (opts?.comparecimento) return statusComparecimento(event, opts.now ?? new Date());

  const daPresenca = statusDaPresenca(event.Presenca ?? "", false);
  if (daPresenca) return daPresenca;

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
  presente: "border-emerald-500/50",
  success: "border-green-400/50",
  danger: "border-destructive/50",
  warning: "border-amber-400/50",
  primary: "border-primary/40",
  // Pendente/sem status = roxo da marca (antes cinza/verde). Contrasta com verde
  // (confirmado/compareceu) e vermelho (falta).
  muted: "border-primary/45",
};

export const TONE_CHIP: Record<StatusTone, string> = {
  presente: "bg-emerald-500/12 text-emerald-700",
  success: "bg-green-400/12 text-green-500",
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-amber-400/12 text-amber-500",
  primary: "bg-primary/12 text-primary",
  muted: "bg-primary/10 text-primary",
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
