import { describe, it, expect } from "vitest";
import { resumoSemanal, segundaDa, semanalParaCsv } from "./comparecimento-semanal";

// Quinta 19/11/2026 12:00 como "agora".
const AGORA = new Date(2026, 10, 19, 12, 0);

describe("segundaDa", () => {
  it("quinta 19/11 -> segunda 16/11", () => {
    expect(segundaDa(new Date(2026, 10, 19))).toEqual(new Date(2026, 10, 16));
  });
  it("domingo 22/11 fecha a semana do dia 16 (seg-dom)", () => {
    expect(segundaDa(new Date(2026, 10, 22))).toEqual(new Date(2026, 10, 16));
  });
  it("segunda 16/11 -> ela mesma", () => {
    expect(segundaDa(new Date(2026, 10, 16))).toEqual(new Date(2026, 10, 16));
  });
});

describe("resumoSemanal", () => {
  const range = { start: new Date(2026, 10, 9), end: new Date(2026, 10, 19, 23, 59) };
  const lista = [
    // semana de 16/11
    { parsedDate: new Date(2026, 10, 16, 9, 0), Presenca: "Compareceu" },
    { parsedDate: new Date(2026, 10, 17, 9, 0), Presenca: "Faltou (não justificada)" },
    { parsedDate: new Date(2026, 10, 18, 9, 0), Presenca: null },                 // passou, sem registro
    { parsedDate: new Date(2026, 10, 19, 15, 0), Presenca: null },                // hoje, ainda vai acontecer
    { parsedDate: new Date(2026, 10, 17, 10, 0), Presenca: null, Cancelamento: "paciente pediu" }, // fora
    // semana de 09/11
    { parsedDate: new Date(2026, 10, 10, 9, 0), Presenca: "Compareceu" },
    { parsedDate: new Date(2026, 10, 11, 9, 0), Presenca: "Compareceu" },
  ];

  it("separa por semana seg-dom, mais recente primeiro", () => {
    const r = resumoSemanal(lista, range, AGORA);
    expect(r.map((l) => l.label)).toEqual(["16/11 a 22/11", "09/11 a 15/11"]);
  });

  it("cancelado fora, futuro fora da taxa, sem registro separado da falta", () => {
    const [atual] = resumoSemanal(lista, range, AGORA);
    expect(atual.consultas).toBe(4);
    expect(atual.compareceu).toBe(1);
    expect(atual.faltou).toBe(1);
    expect(atual.semRegistro).toBe(1);
    expect(atual.aAcontecer).toBe(1);
    expect(atual.taxa).toBe(50);
  });

  it("semana sem nada resolvido tem taxa null (e não 0%)", () => {
    const r = resumoSemanal(
      [{ parsedDate: new Date(2026, 10, 19, 15, 0), Presenca: null }],
      { start: new Date(2026, 10, 16), end: new Date(2026, 10, 19) },
      AGORA,
    );
    expect(r[0].taxa).toBeNull();
  });

  it("csv tem cabeçalho e uma linha por semana", () => {
    const csv = semanalParaCsv(resumoSemanal(lista, range, AGORA));
    const linhas = csv.split("\n");
    expect(linhas[0]).toContain("Semana;Consultas;Compareceu;Faltou");
    expect(linhas).toHaveLength(3);
  });
});
