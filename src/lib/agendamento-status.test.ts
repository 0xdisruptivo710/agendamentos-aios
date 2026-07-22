import { describe, it, expect } from "vitest";
import { deriveStatus, guessOrigem, PRESENCA } from "./agendamento-status";

type S = Parameters<typeof deriveStatus>[0];
const ev = (o: Partial<S>): S => ({ Presenca: null, Agendou: null, "Confirmação": null, ...o });

describe("deriveStatus — cadeia de prioridade", () => {
  it("presença 'Compareceu' vence tudo (tom success)", () => {
    const s = deriveStatus(ev({ Presenca: PRESENCA.COMPARECEU, Agendou: "Não", "Confirmação": "Cancelado" }));
    expect(s.key).toBe("compareceu");
    expect(s.tone).toBe("success");
  });

  it("falta justificada -> tom danger, preserva o rótulo", () => {
    const s = deriveStatus(ev({ Presenca: PRESENCA.FALTOU_JUSTIFICADA }));
    expect(s.key).toBe("faltou");
    expect(s.tone).toBe("danger");
    expect(s.label).toBe(PRESENCA.FALTOU_JUSTIFICADA);
  });

  it("sem presença, Agendou 'Sim' => confirmado", () => {
    expect(deriveStatus(ev({ Agendou: "Sim" })).key).toBe("confirmado");
  });

  it("sem presença, Agendou 'Não' => pendente ('Não confirmado')", () => {
    const s = deriveStatus(ev({ Agendou: "Não" }));
    expect(s.key).toBe("pendente");
    expect(s.label).toBe("Não confirmado");
  });

  it("cai na Confirmação legada quando não há campos clínicos", () => {
    expect(deriveStatus(ev({ "Confirmação": "Confirmado ok" })).key).toBe("confirmado");
    expect(deriveStatus(ev({ "Confirmação": "Cancelado" })).key).toBe("cancelado");
    expect(deriveStatus(ev({ "Confirmação": "Reagendado" })).key).toBe("reagendado");
  });

  it("tudo vazio => pendente", () => {
    const s = deriveStatus(ev({}));
    expect(s.key).toBe("pendente");
    expect(s.label).toBe("Pendente");
  });
});

describe("guessOrigem — heurística não-destrutiva", () => {
  it("prefixo de convênio => Convênio", () => {
    expect(guessOrigem("C- 20103115 Atividade Reflexa (2Xsemana)")).toBe("Convênio");
    expect(guessOrigem("BC 50000241CONS.DOMIC.FISIOTERAPIA")).toBe("Convênio");
    expect(guessOrigem("AFISVEC  20103514")).toBe("Convênio");
  });

  it("particular / desconhecido => null (não chuta)", () => {
    expect(guessOrigem("PILATES 2x Semana - Mensal")).toBeNull();
    expect(guessOrigem("")).toBeNull();
    expect(guessOrigem(null)).toBeNull();
  });
});
