// Bloqueios da agenda: janela de almoço e feriados.
//
// Módulo PURO de propósito — nada de rede, nada de Date em UTC. As datas do
// painel são string local "dd/MM/yyyy HH:mm" do começo ao fim, e a comparação
// é feita em cima da string. Passar por Date/UTC aqui é exatamente onde erro de
// fuso se esconde (a mesma consulta viraria outro dia dependendo do servidor).

export interface JanelaAlmoco {
  inicio: string; // "HH:mm" — inclusivo
  fim: string;    // "HH:mm" — EXCLUSIVO (14:00 é a reabertura, não bloqueia)
}

const RE_DATA = /^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})/;

const dd = (n: number) => String(n).padStart(2, "0");
const chave = (d: Date) => `${dd(d.getDate())}/${dd(d.getMonth() + 1)}/${d.getFullYear()}`;

// Domingo de Páscoa (algoritmo gregoriano anônimo / Meeus). Base dos móveis.
function domingoDePascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function somaDias(base: Date, dias: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + dias);
  return d;
}

// Feriados NACIONAIS de um ano: "dd/MM/yyyy" -> nome.
//
// Só os legalmente obrigatórios. Carnaval e Corpus Christi são ponto
// facultativo e ficam de FORA por escolha: quem fecha nesses dias cadastra
// pela tela. Bloquear a mais seria pior, porque não haveria como desfazer —
// a lista da UI só sabe acrescentar.
const cacheAno = new Map<number, Map<string, string>>();

export function feriadosNacionais(ano: number): Map<string, string> {
  // Cache por ano: uma recorrência de 50 sessões chamaria isto 50 vezes e
  // reconstruiria o mesmo mapa. O resultado é determinístico, então guardar é
  // seguro (e a lista de um ano nunca muda em tempo de execução).
  const emCache = cacheAno.get(ano);
  if (emCache) return emCache;
  const f = new Map<string, string>();
  const fixos: [string, string][] = [
    ["01/01", "Confraternização Universal"],
    ["21/04", "Tiradentes"],
    ["01/05", "Dia do Trabalho"],
    ["07/09", "Independência"],
    ["12/10", "Nossa Senhora Aparecida"],
    ["02/11", "Finados"],
    ["15/11", "Proclamação da República"],
    ["20/11", "Consciência Negra"],
    ["25/12", "Natal"],
  ];
  for (const [dm, nome] of fixos) f.set(`${dm}/${ano}`, nome);
  f.set(chave(somaDias(domingoDePascoa(ano), -2)), "Sexta-feira Santa");
  cacheAno.set(ano, f);
  return f;
}

export interface OpcoesBloqueio {
  almoco?: JanelaAlmoco;
  /** Feriados da unidade cadastrados pela tela: "dd/MM/yyyy" -> descrição. */
  feriadosExtras?: Map<string, string>;
}

// Motivo pelo qual a data/hora não pode receber agendamento, ou null se livre.
// Feriado vence almoço: bloqueia o dia inteiro.
export function motivoBloqueio(dataStr: string, opts: OpcoesBloqueio): string | null {
  const m = RE_DATA.exec(String(dataStr || ""));
  if (!m) return null; // formato inesperado: validar formato não é papel deste módulo
  const [, diaS, mesS, anoS, hh, mi] = m;
  const dataChave = `${diaS}/${mesS}/${anoS}`;

  const extra = opts.feriadosExtras?.get(dataChave);
  if (extra) return `${extra} (feriado)`;
  const nacional = feriadosNacionais(Number(anoS)).get(dataChave);
  if (nacional) return `${nacional} (feriado)`;

  if (opts.almoco) {
    // "HH:mm" zero-padded compara certo como string — evita Date por completo
    const hora = `${hh}:${mi}`;
    if (hora >= opts.almoco.inicio && hora < opts.almoco.fim) {
      return `horário de almoço (${opts.almoco.inicio} às ${opts.almoco.fim})`;
    }
  }
  return null;
}

// Açúcar para os modais: primeira data bloqueada de uma lista, com o motivo.
export function primeiraBloqueada(
  datas: string[],
  opts: OpcoesBloqueio,
): { data: string; motivo: string } | null {
  for (const d of datas) {
    const motivo = motivoBloqueio(d, opts);
    if (motivo) return { data: d, motivo };
  }
  return null;
}
