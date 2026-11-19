import { describe, expect, it } from "vitest";
import {
  agruparPorChave, chaveNome, chaveProcedimento, rotuloProcedimento, tipoDoProcedimento,
} from "./relatorio-normaliza";

describe("chaveNome", () => {
  it("junta acento, caixa e espaço sobrando", () => {
    expect(chaveNome("Bárbara Sena")).toBe(chaveNome("Barbara sena "));
    expect(chaveNome("Nice  Oliveira ")).toBe(chaveNome("Nice oliveira"));
  });
});

describe("agruparPorChave", () => {
  it("soma as grafias e mostra a mais usada", () => {
    const xs = ["Bárbara Sena", "Bárbara Sena", "Barbara sena ", "Barbara Sena", "Elis"];
    const g = agruparPorChave(xs, (x) => x, chaveNome).sort((a, b) => b.value - a.value);
    expect(g).toEqual([{ name: "Bárbara Sena", value: 4 }, { name: "Elis", value: 1 }]);
  });
});

describe("chaveProcedimento", () => {
  it("junta código solto com e sem nome do convênio", () => {
    const k = chaveProcedimento("3115");
    expect(chaveProcedimento(" cabergs 3115")).toBe(k);
    expect(chaveProcedimento("3115 cabergs")).toBe(k);
    expect(chaveProcedimento("cabers 3115")).toBe(k);
    expect(rotuloProcedimento(" cabergs 3115")).toBe("Código 3115");
  });
  it("reduz o código de 8 dígitos e tira o C-", () => {
    expect(chaveProcedimento("C- 20103115 Atividade Reflexa (2Xsemana)"))
      .toBe(chaveProcedimento("c-20103115 atividade reflexa (2xsemana)"));
    expect(chaveProcedimento("C- 20103115 Atividade Reflexa (2Xsemana)")).toBe("3115 atividade reflexa (2xsemana)");
  });
});

describe("tipoDoProcedimento", () => {
  const cats = ["Avaliação", "Atividade Reflexa", "RPG", "Pilates", "Reabilitação Osteomuscular"];
  it("deduz pelo nome por extenso", () => {
    expect(tipoDoProcedimento("C- 20103115 Atividade Reflexa (2Xsemana)", cats)).toBe("Atividade Reflexa");
    expect(tipoDoProcedimento("C- RPG 20103115 (1xsemana)", cats)).toBe("RPG");
    expect(tipoDoProcedimento("PILATES/FISIO", cats)).toBe("Pilates");
  });
  it("não chuta com código solto", () => {
    expect(tipoDoProcedimento("3115", cats)).toBeNull();
    expect(tipoDoProcedimento(null, cats)).toBeNull();
  });
});
