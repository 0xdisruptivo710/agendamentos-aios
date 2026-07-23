import { describe, it, expect } from "vitest";
import { normalizePhoneBR, generateOccurrences, singleOccurrence } from "./agendamento-create";

describe("normalizePhoneBR", () => {
  it("celular formatado (11 díg) ganha 55", () => {
    expect(normalizePhoneBR("(15) 99742-4782")).toBe("5515997424782");
  });
  it("fixo/celular 10 díg ganha 55", () => {
    expect(normalizePhoneBR("15 3222-1000")).toBe("551532221000");
  });
  it("já com 55 é mantido", () => {
    expect(normalizePhoneBR("5515997424782")).toBe("5515997424782");
  });
  it("curto demais => null", () => {
    expect(normalizePhoneBR("99742")).toBeNull();
    expect(normalizePhoneBR("")).toBeNull();
  });
});

describe("generateOccurrences", () => {
  it("Seg+Qua, 6 sessões, a partir de uma segunda (27/07/2026)", () => {
    const datas = generateOccurrences({ startDate: "2026-07-27", time: "14:00", weekdays: [1, 3], count: 6 });
    expect(datas).toEqual([
      "27/07/2026 14:00", // seg
      "29/07/2026 14:00", // qua
      "03/08/2026 14:00", // seg
      "05/08/2026 14:00", // qua
      "10/08/2026 14:00", // seg
      "12/08/2026 14:00", // qua
    ]);
  });
  it("respeita a contagem e o horário fixo", () => {
    const datas = generateOccurrences({ startDate: "2026-07-28", time: "09:30", weekdays: [2], count: 3 });
    expect(datas).toHaveLength(3);
    expect(datas.every((d) => d.endsWith("09:30"))).toBe(true);
  });
  it("sem dias da semana => vazio (não gera nada)", () => {
    expect(generateOccurrences({ startDate: "2026-07-28", time: "14:00", weekdays: [], count: 5 })).toEqual([]);
  });
});

describe("singleOccurrence", () => {
  it("formata data única", () => {
    expect(singleOccurrence("2026-07-08", "14:00")).toEqual(["08/07/2026 14:00"]);
  });
  it("sem hora => vazio", () => {
    expect(singleOccurrence("2026-07-08", "")).toEqual([]);
  });
});
