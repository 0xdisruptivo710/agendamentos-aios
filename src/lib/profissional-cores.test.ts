import { describe, it, expect } from "vitest";
import { corDoProfissional, legendaCores, normalizarTexto } from "./profissional-cores";

// Config real da Fisio Vida (units.ts).
const CORES = { Nice: "vermelho", Elis: "amarelo", Lenisa: "roxo", Pedro: "azul", Pietra: "verde" };

describe("corDoProfissional", () => {
  it("casa o nome completo da tabela pelo primeiro nome do config", () => {
    expect(corDoProfissional(CORES, "Lenisa Macedo dos Santos")?.dot).toBe("bg-violet-500");
    expect(corDoProfissional(CORES, "Pedro Igo Lopes Ribeiro")?.dot).toBe("bg-blue-500");
    expect(corDoProfissional(CORES, "Nice oliveira")?.dot).toBe("bg-red-500");
    expect(corDoProfissional(CORES, "Pietra Emanuelle de Souza Magalhães")?.dot).toBe("bg-emerald-500");
    expect(corDoProfissional(CORES, "Elis Regina Rocha")?.dot).toBe("bg-yellow-400");
  });
  it("ignora caixa e acento", () => {
    expect(corDoProfissional(CORES, "PÉDRO igo")?.key).toBe("Pedro");
  });
  it("profissional sem cor definida => null", () => {
    expect(corDoProfissional(CORES, "RAFAEL BORBA")).toBeNull();
  });
  it("sem config ou sem responsável => null", () => {
    expect(corDoProfissional(undefined, "Pedro")).toBeNull();
    expect(corDoProfissional(CORES, null)).toBeNull();
  });
});

describe("legendaCores", () => {
  it("gera um item por profissional com cor válida", () => {
    expect(legendaCores(CORES)).toHaveLength(5);
    expect(legendaCores({ X: "cor-inexistente" })).toEqual([]);
    expect(legendaCores(undefined)).toEqual([]);
  });
});

describe("normalizarTexto", () => {
  it("remove acento e baixa a caixa", () => {
    expect(normalizarTexto("  João MAGALHÃES ")).toBe("joao magalhaes");
  });
});
