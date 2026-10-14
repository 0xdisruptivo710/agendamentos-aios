// Convênio POR NOME (Cabergs / AFISVEC / Banco Central / Particular) — só nas
// unidades com config.convenios. O campo nativo Origem separa apenas
// Convênio x Particular; isto aqui diz QUAL convênio.
//
// A clínica não tem campo de convênio: o convênio é DIGITADO dentro do
// Procedimento, em dezenas de grafias ("C- 20103115 Atividade Reflexa
// (2Xsemana)", " cabergs 3115", "3115", "BANCO  CENTRAL" com dois espaços,
// "AFISVEC  20103514", "cabers 3484"). Por isso a derivação tem 3 camadas:
//   1) marcador no próprio Procedimento;
//   2) convênio DOMINANTE do mesmo paciente (é o que resolve os códigos soltos);
//   3) o campo Origem, que só distingue Convênio x Particular.
// O que não fecha vira "Convênio (a identificar)" ou "Sem informação" — de
// propósito, para a clínica ver o tamanho do vão em vez de receber palpite.
//
// Medido na base da Fisio Vida em 14/10/2026 (10.820 linhas): a camada 1
// resolve 7.820, a 2 mais 1.647, e 974 linhas (9%) ficam nos baldes honestos.
//
// Por que NÃO deduzir convênio do código do procedimento: "3115" sozinho está
// em 1.233 linhas de paciente Cabergs e em 56 de paciente particular, e o
// código 20103514 aparece tanto em "C- 20103514" quanto em "AFISVEC 20103514"
// — o código é do procedimento, não do convênio. Já propagar por paciente é
// seguro: dos 184 pacientes com alguma linha marcada, 182 têm um convênio só.
import type { RegraConvenio } from "@/config/units";
import type { Agendamento } from "@/hooks/useAgendamentos";
import { ORIGEM } from "@/lib/agendamento-status";

// Os dois baldes honestos. Ficam sempre no fim das colunas e da legenda.
export const CONVENIO_A_IDENTIFICAR = "Convênio (a identificar)";
export const CONVENIO_SEM_INFO = "Sem informação";

// Sem acento, sem caixa e com espaço colapsado ("BANCO  CENTRAL" -> "banco
// central"). NÃO faz trim: um marcador como "bc " depende do espaço do fim.
function base(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ");
}

// Marcador casa no começo do texto ou depois de um caractere que não é
// letra/dígito, para "bc " não casar dentro de "abc " nem "c-" dentro de "abc-".
function regexDoMarcador(marcador: string): RegExp {
  const esc = base(marcador).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(^|[^a-z0-9])" + esc);
}

export interface RegraCompilada {
  nome: string;
  res: RegExp[];
}

// Compila uma vez por dataset: classificar 10 mil linhas recompilando o regex
// de cada marcador por linha custaria ~40 mil compilações por render.
export function compilarRegras(regras: RegraConvenio[] | undefined): RegraCompilada[] {
  return (regras ?? []).map((r) => ({ nome: r.nome, res: r.marcadores.map(regexDoMarcador) }));
}

// Camada 1: marcador no próprio Procedimento. A ORDEM das regras no config é a
// ordem de teste — a primeira que casa vence (AFISVEC e Banco Central antes de
// Cabergs, que é o mais genérico).
export function convenioMarcado(
  procedimento: string | null | undefined,
  compiladas: RegraCompilada[],
): string | null {
  if (!procedimento) return null;
  const p = base(procedimento);
  if (!p.trim()) return null;
  for (const r of compiladas) {
    if (r.res.some((re) => re.test(p))) return r.nome;
  }
  return null;
}

// Identidade do paciente para a propagação: telefone só com dígitos (a base
// guarda 55+DDD+número) e, quando não há telefone, o nome normalizado.
function pacienteKey(e: Agendamento): string {
  const fone = (e["Número"] ?? "").replace(/\D/g, "");
  if (fone) return "f:" + fone;
  const nome = base(e.Nome ?? "").trim();
  return nome ? "n:" + nome : "";
}

// Mapa id -> convênio para TODA a lista. Recebe a lista completa de propósito:
// a propagação por paciente precisa do histórico inteiro, senão um período em
// que o paciente só tem linha de código solto perderia o convênio dele.
export function derivarConvenios(
  eventos: Agendamento[],
  regras: RegraConvenio[] | undefined,
): Map<number, string> {
  const out = new Map<number, string>();
  if (!regras?.length) return out;
  const compiladas = compilarRegras(regras);
  const ordem = new Map(regras.map((r, i) => [r.nome, i]));

  // Camada 1 + contagem por paciente.
  const marcado = new Map<number, string>();
  const porPaciente = new Map<string, Map<string, number>>();
  for (const e of eventos) {
    const conv = convenioMarcado(e.Procedimento, compiladas);
    if (!conv) continue;
    marcado.set(e.id, conv);
    const k = pacienteKey(e);
    if (!k) continue;
    const contagem = porPaciente.get(k) ?? new Map<string, number>();
    contagem.set(conv, (contagem.get(conv) ?? 0) + 1);
    porPaciente.set(k, contagem);
  }

  // Convênio dominante de cada paciente. Empate desempata pela ordem do config.
  const dominante = new Map<string, string>();
  for (const [k, contagem] of porPaciente) {
    let melhor: string | null = null;
    let melhorN = -1;
    for (const [conv, n] of contagem) {
      const ganha =
        n > melhorN ||
        (n === melhorN && (ordem.get(conv) ?? 99) < (ordem.get(melhor ?? "") ?? 99));
      if (ganha) {
        melhor = conv;
        melhorN = n;
      }
    }
    if (melhor) dominante.set(k, melhor);
  }

  // Camadas 2 e 3.
  for (const e of eventos) {
    const direto = marcado.get(e.id);
    if (direto) {
      out.set(e.id, direto);
      continue;
    }
    const k = pacienteKey(e);
    const herdado = k ? dominante.get(k) : undefined;
    if (herdado) {
      out.set(e.id, herdado);
      continue;
    }
    const origem = (e.Origem ?? "").trim();
    if (origem === ORIGEM.PARTICULAR) out.set(e.id, ORIGEM.PARTICULAR);
    else if (origem === ORIGEM.CONVENIO) out.set(e.id, CONVENIO_A_IDENTIFICAR);
    else out.set(e.id, CONVENIO_SEM_INFO);
  }
  return out;
}

export interface CruzadaLinha {
  nome: string;
  celulas: number[];
  total: number;
}

export interface Cruzada {
  colunas: string[];
  linhas: CruzadaLinha[];
  totais: number[];
  total: number;
}

const SEM_RESPONSAVEL = "Sem responsável";

// Tabela profissional x convênio (o que a clínica precisa para fechar com cada
// convênio). Colunas ordenadas por volume, com os dois baldes honestos no fim;
// linhas por volume. Sem linha nem coluna zerada.
export function cruzarProfissionalConvenio(
  eventos: Agendamento[],
  convenios: Map<number, string>,
): Cruzada {
  const porProf = new Map<string, Map<string, number>>();
  const totalPorConv = new Map<string, number>();

  for (const e of eventos) {
    const conv = convenios.get(e.id);
    if (!conv) continue;
    const prof = (e.Responsavel_Atendimento ?? "").trim() || SEM_RESPONSAVEL;
    const linha = porProf.get(prof) ?? new Map<string, number>();
    linha.set(conv, (linha.get(conv) ?? 0) + 1);
    porProf.set(prof, linha);
    totalPorConv.set(conv, (totalPorConv.get(conv) ?? 0) + 1);
  }

  const rank = (c: string) => (c === CONVENIO_A_IDENTIFICAR ? 1 : c === CONVENIO_SEM_INFO ? 2 : 0);
  const colunas = Array.from(totalPorConv.keys()).sort((a, b) => {
    const r = rank(a) - rank(b);
    return r !== 0 ? r : (totalPorConv.get(b) ?? 0) - (totalPorConv.get(a) ?? 0);
  });

  const linhas: CruzadaLinha[] = Array.from(porProf.entries())
    .map(([nome, m]) => {
      const celulas = colunas.map((c) => m.get(c) ?? 0);
      return { nome, celulas, total: celulas.reduce((a, b) => a + b, 0) };
    })
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));

  const totais = colunas.map((c) => totalPorConv.get(c) ?? 0);
  return { colunas, linhas, totais, total: totais.reduce((a, b) => a + b, 0) };
}

// CSV da tabela cruzada (a clínica fecha o mês com cada convênio em planilha).
// Ponto e vírgula + BOM: é o que o Excel pt-BR abre em colunas sem perder acento.
export function cruzadaParaCsv(c: Cruzada, titulo: string): string {
  const aspas = String.fromCharCode(34);
  const campo = (v: string) => aspas + v.split(aspas).join(aspas + aspas) + aspas;
  const linhas = [
    [titulo, ...c.colunas, "Total"],
    ...c.linhas.map((l) => [l.nome, ...l.celulas.map(String), String(l.total)]),
    ["Total", ...c.totais.map(String), String(c.total)],
  ];
  return "﻿" + linhas.map((l) => l.map(campo).join(";")).join("\r\n");
}
