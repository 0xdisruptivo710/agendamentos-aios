import { describe, it, expect } from "vitest";
import { feriadosNacionais, motivoBloqueio, type JanelaAlmoco } from "./agenda-bloqueios";
import { generateOccurrences } from "./agendamento-create";
import { UNITS } from "@/config/units";

const ALMOCO: JanelaAlmoco = { inicio: "12:30", fim: "14:00" };

describe("motivoBloqueio — janela de almoço", () => {
  // As quatro bordas. Início inclusivo, fim exclusivo: 14:00 é a reabertura.
  it("12:29 passa (um minuto antes de fechar)", () => {
    expect(motivoBloqueio("10/03/2027 12:29", { almoco: ALMOCO })).toBeNull();
  });
  it("12:30 bloqueia (primeiro minuto do almoço)", () => {
    expect(motivoBloqueio("10/03/2027 12:30", { almoco: ALMOCO })).toMatch(/almoço/i);
  });
  it("13:59 bloqueia (último minuto do almoço)", () => {
    expect(motivoBloqueio("10/03/2027 13:59", { almoco: ALMOCO })).toMatch(/almoço/i);
  });
  it("14:00 passa (reabertura)", () => {
    expect(motivoBloqueio("10/03/2027 14:00", { almoco: ALMOCO })).toBeNull();
  });
  it("sem config de almoço, nada é bloqueado por horário", () => {
    expect(motivoBloqueio("10/03/2027 13:00", {})).toBeNull();
  });
});

describe("motivoBloqueio — feriados", () => {
  it("feriado nacional de data fixa bloqueia", () => {
    expect(motivoBloqueio("25/12/2027 09:00", { almoco: ALMOCO })).toMatch(/natal/i);
  });
  it("feriado bloqueia o dia inteiro, inclusive fora do almoço", () => {
    expect(motivoBloqueio("01/01/2027 17:00", {})).not.toBeNull();
  });
  it("extra cadastrado pela unidade bloqueia", () => {
    const extras = new Map([["10/03/2027", "Recesso"]]);
    expect(motivoBloqueio("10/03/2027 09:00", { feriadosExtras: extras })).toMatch(/recesso/i);
  });
  it("extra de outro dia não interfere", () => {
    const extras = new Map([["11/03/2027", "Recesso"]]);
    expect(motivoBloqueio("10/03/2027 09:00", { feriadosExtras: extras })).toBeNull();
  });
  it("dia útil comum fora do almoço passa", () => {
    expect(motivoBloqueio("10/03/2027 09:00", { almoco: ALMOCO })).toBeNull();
  });
});

describe("feriadosNacionais", () => {
  it("Sexta-feira Santa acompanha a Páscoa em anos diferentes", () => {
    // Páscoa: 28/03/2027 e 16/04/2028 -> Sexta Santa 2 dias antes.
    // (é justamente por variar ~1 mês entre anos que ela não pode ser fixa)
    expect(feriadosNacionais(2027).has("26/03/2027")).toBe(true);
    expect(feriadosNacionais(2028).has("14/04/2028")).toBe(true);
  });
  it("traz os fixos do ano", () => {
    const f = feriadosNacionais(2027);
    for (const d of ["01/01/2027", "21/04/2027", "01/05/2027", "07/09/2027",
                     "12/10/2027", "02/11/2027", "15/11/2027", "20/11/2027", "25/12/2027"]) {
      expect(f.has(d)).toBe(true);
    }
  });
  it("NÃO inclui ponto facultativo (Carnaval/Corpus Christi)", () => {
    // Deixados de fora de propósito: quem fecha nesses dias cadastra pela tela.
    // Bloquear a mais não teria como ser desfeito pela UI.
    const f = feriadosNacionais(2027);
    expect(f.has("09/02/2027")).toBe(false); // terça de carnaval
    expect(f.has("27/05/2027")).toBe(false); // corpus christi
  });
  it("datas fora do ano pedido não aparecem", () => {
    expect(feriadosNacionais(2027).has("25/12/2028")).toBe(false);
  });
});

describe("motivoBloqueio — entradas ruins", () => {
  it("string fora do formato não bloqueia (não é papel deste módulo validar)", () => {
    expect(motivoBloqueio("2027-03-10 13:00", { almoco: ALMOCO })).toBeNull();
    expect(motivoBloqueio("", { almoco: ALMOCO })).toBeNull();
  });
});

describe("alcance do bloqueio no registry", () => {
  // O registry tem ~30 unidades compartilhando o mesmo app. Um bloqueio que
  // vazasse para as outras fecharia a agenda de clínicas que atendem no almoço.
  const comBloqueio = UNITS.filter((u) => u.config?.almoco || u.config?.feriados).map((u) => u.slug);

  it("só as 3 agendas do OdontoCompany bloqueiam", () => {
    expect([...comBloqueio].sort()).toEqual(
      ["odontocompany", "odontocompany-santa-rosalia", "odontocompany-vila-helena"].sort(),
    );
  });
  it("as demais unidades seguem sem almoço e sem feriado", () => {
    const outras = UNITS.filter((u) => !comBloqueio.includes(u.slug));
    expect(outras.length).toBeGreaterThan(20); // não é uma lista vazia por acidente
    for (const u of outras) {
      expect(u.config?.almoco, u.slug).toBeUndefined();
      expect(u.config?.feriados, u.slug).toBeUndefined();
    }
  });
  it("as 3 agendas do Odonto usam a mesma janela 12:30-14:00", () => {
    for (const slug of comBloqueio) {
      const u = UNITS.find((x) => x.slug === slug)!;
      expect(u.config?.almoco, slug).toEqual({ inicio: "12:30", fim: "14:00" });
      expect(u.config?.feriados, slug).toBe(true);
    }
  });
});

describe("generateOccurrences com skip", () => {
  it("pula data bloqueada e segue até completar a contagem", () => {
    // Quartas a partir de 30/12/2026: 30/12 passa, 06/01 passa...
    // bloqueando 06/01/2027 a série tem que buscar a quarta seguinte.
    const bloqueado = (d: string) => d.startsWith("06/01/2027");
    const datas = generateOccurrences(
      { startDate: "2026-12-30", time: "09:00", weekdays: [3], count: 3 },
      bloqueado,
    );
    expect(datas).toEqual(["30/12/2026 09:00", "13/01/2027 09:00", "20/01/2027 09:00"]);
  });
  it("sem skip o comportamento é o de antes (outras unidades não mudam)", () => {
    const datas = generateOccurrences({ startDate: "2026-07-27", time: "14:00", weekdays: [1, 3], count: 4 });
    expect(datas).toEqual(["27/07/2026 14:00", "29/07/2026 14:00", "03/08/2026 14:00", "05/08/2026 14:00"]);
  });
});
