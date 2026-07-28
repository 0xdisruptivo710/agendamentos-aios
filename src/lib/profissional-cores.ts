// Cor por profissional (Resp. atendimento) — unidades com config.cores.
// A cor NÃO substitui a cor de status dos cards (verde/vermelho/roxo continua
// dizendo compareceu/faltou/pendente); ela entra como um marcador extra (bolinha
// e chip) para identificar de quem é o atendimento de bater o olho.
import type { UnitConfig } from "@/config/units";

export interface ProfColor {
  key: string;   // nome como declarado no config (ex.: "Nice")
  dot: string;   // classe da bolinha (background sólido)
  chip: string;  // classes de chip (bg suave + texto)
}

// Paleta fixa com classes literais (Tailwind não compila classe dinâmica).
const PALETA: Record<string, { dot: string; chip: string }> = {
  vermelho: { dot: "bg-red-500",     chip: "bg-red-500/12 text-red-600" },
  amarelo:  { dot: "bg-yellow-400",  chip: "bg-yellow-400/15 text-yellow-600" },
  roxo:     { dot: "bg-violet-500",  chip: "bg-violet-500/12 text-violet-600" },
  azul:     { dot: "bg-blue-500",    chip: "bg-blue-500/12 text-blue-600" },
  verde:    { dot: "bg-emerald-500", chip: "bg-emerald-500/12 text-emerald-600" },
  laranja:  { dot: "bg-orange-500",  chip: "bg-orange-500/12 text-orange-600" },
  rosa:     { dot: "bg-pink-500",    chip: "bg-pink-500/12 text-pink-600" },
};

// Normalização de texto pt-BR (sem acento/caixa) — usada aqui no match de
// profissional e na barra de busca de paciente do UnitPanel.
export function normalizarTexto(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

const norm = normalizarTexto;

// Resolve a cor do profissional a partir do "Resp. atendimento" gravado na linha.
// A tabela guarda nome completo ("Pietra Emanuelle de Souza Magalhães"); o config
// declara só o primeiro nome, então o match é por prefixo, sem acento/caixa.
export function corDoProfissional(
  cores: UnitConfig["cores"],
  respAtendimento: string | null | undefined,
): ProfColor | null {
  if (!cores || !respAtendimento) return null;
  const resp = norm(respAtendimento);
  if (!resp) return null;
  for (const [key, corNome] of Object.entries(cores)) {
    const pal = PALETA[norm(corNome)];
    if (!pal) continue;
    if (resp.startsWith(norm(key))) return { key, ...pal };
  }
  return null;
}

// Lista (nome -> cor) para renderizar a legenda acima da agenda.
export function legendaCores(cores: UnitConfig["cores"]): ProfColor[] {
  if (!cores) return [];
  return Object.entries(cores)
    .map(([key, corNome]) => {
      const pal = PALETA[norm(corNome)];
      return pal ? { key, ...pal } : null;
    })
    .filter((c): c is ProfColor => c !== null);
}
