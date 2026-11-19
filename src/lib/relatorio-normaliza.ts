// Normalizações do relatório: a agenda é digitada à mão, então a mesma
// profissional e o mesmo procedimento aparecem em várias grafias
// ("Bárbara Sena", "Barbara sena ", "BARBARA SENA"; "3115", " cabergs 3115").
// Agrupar pela grafia crua partia a mesma pessoa em várias barras (Fisio Vida,
// 19/11/2026: a Bárbara aparecia com 98 atendimentos quando tinha 267).

// Nome sem acento, sem caixa e com espaço colapsado.
export function chaveNome(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Agrupa por uma chave normalizada e devolve, por grupo, a grafia mais usada
// (para a tela mostrar um nome legível) e o total. Itens sem chave são pulados.
export function agruparPorChave<T>(
  arr: T[],
  valor: (i: T) => string | null | undefined,
  chave: (s: string) => string,
): { name: string; value: number }[] {
  const grupos = new Map<string, Map<string, number>>();
  for (const item of arr) {
    const cru = (valor(item) ?? "").trim();
    if (!cru) continue;
    const k = chave(cru);
    if (!k) continue;
    const g = grupos.get(k) ?? new Map<string, number>();
    g.set(cru, (g.get(cru) ?? 0) + 1);
    grupos.set(k, g);
  }
  return Array.from(grupos.values()).map((g) => {
    const grafias = Array.from(g.entries()).sort((a, b) => b[1] - a[1]);
    return { name: grafias[0][0], value: grafias.reduce((acc, [, n]) => acc + n, 0) };
  });
}

// Mapa chave -> grafia mais usada, para quem precisa trocar o nome cru pelo
// nome de exibição item a item (tabela profissional x convênio, ficha).
export function nomeCanonicoPorChave<T>(
  arr: T[],
  valor: (i: T) => string | null | undefined,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const g of agruparPorChave(arr, valor, chaveNome)) out.set(chaveNome(g.name), g.name);
  return out;
}

// Procedimento: tira o nome do convênio e o prefixo "C-", e reduz o código
// TUSS de 8 dígitos (2010xxxx) aos 4 finais, que é como a recepção digita
// solto. Assim "3115", " cabergs 3115" e "3115 cabergs" viram o mesmo item.
// Não tenta adivinhar o nome do procedimento a partir do código: o mesmo 3115
// aparece em Atividade Reflexa e em RPG.
const MARCAS_CONVENIO = /\b(cabergs|cabers|afisvec|banco central|particular)\b/g;
export function chaveProcedimento(s: string): string {
  return chaveNome(s)
    .replace(/^c\s*-\s*/, "")
    .replace(MARCAS_CONVENIO, " ")
    .replace(/\b2010(\d{4})\b/g, "$1")
    .replace(/[^a-z0-9()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Rótulo do grupo de procedimento: com só o código, deixa explícito que é
// código; senão a grafia mais usada.
export function rotuloProcedimento(grafia: string): string {
  const k = chaveProcedimento(grafia);
  return /^\d{4}$/.test(k) ? `Código ${k}` : grafia.trim();
}

// Tipo (categoria) de uma sessão com o campo Tipo vazio, deduzido do
// Procedimento pelas categorias da unidade. Só casa quando o Procedimento
// contém o nome da categoria escrito por extenso; código solto fica sem tipo.
export function tipoDoProcedimento(
  procedimento: string | null | undefined,
  categorias: string[] | undefined,
): string | null {
  if (!procedimento || !categorias?.length) return null;
  const p = chaveNome(procedimento);
  // Categoria mais longa primeiro ("Reabilitação Osteomuscular" antes de algo curto).
  const ordenadas = [...categorias].sort((a, b) => b.length - a.length);
  for (const c of ordenadas) {
    const k = chaveNome(c);
    if (k && new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(p)) return c;
  }
  return null;
}
