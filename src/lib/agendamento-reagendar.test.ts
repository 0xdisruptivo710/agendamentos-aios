import { describe, it, expect } from "vitest";
import { buildDataString, findFutureSiblings, sessoesFuturasDoPaciente, shiftSessao } from "./agendamento-reagendar";
import type { Agendamento } from "@/hooks/useAgendamentos";

// Linha mínima para os testes (só os campos que os helpers leem).
function ag(partial: Partial<Agendamento> & { id: number }): Agendamento {
  return {
    created_at: "",
    Data: null,
    parsedDate: null,
    dayKey: null,
    Nome: null,
    "Número": null,
    Anotações: null,
    Confirmação: null,
    "1 Dia antes": null,
    "No dia": null,
    Valor: null,
    Responsavel_Agendamento: null,
    Responsavel_Atendimento: null,
    Tipo: null,
    Procedimento: null,
    Cancelamento: null,
    Agendou: null,
    Origem: null,
    Presenca: null,
    Justificativa: null,
    ...partial,
  };
}

describe("buildDataString", () => {
  it("monta o formato texto da tabela", () => {
    expect(buildDataString("2026-08-03", "14:30")).toBe("03/08/2026 14:30");
  });
  it("parte inválida => null", () => {
    expect(buildDataString("", "14:30")).toBeNull();
    expect(buildDataString("2026-08-03", "")).toBeNull();
  });
});

describe("findFutureSiblings", () => {
  // Sessão aberta: terça 04/08/2026 08:00, paciente 5551999990000.
  const base = ag({ id: 1, "Número": "5551999990000", Nome: "Maria", parsedDate: new Date(2026, 7, 4, 8, 0) });
  const lista = [
    base,
    // Futuras da mesma recorrência (terças 08:00):
    ag({ id: 2, "Número": "5551999990000", parsedDate: new Date(2026, 7, 11, 8, 0) }),
    ag({ id: 3, "Número": "5551999990000", parsedDate: new Date(2026, 7, 18, 8, 0) }),
    // Terça 08:00 mas PASSADA:
    ag({ id: 4, "Número": "5551999990000", parsedDate: new Date(2026, 6, 28, 8, 0) }),
    // Futura mas em outro horário:
    ag({ id: 5, "Número": "5551999990000", parsedDate: new Date(2026, 7, 11, 9, 0) }),
    // Futura, mesmo horário, mas outro dia da semana (quinta):
    ag({ id: 6, "Número": "5551999990000", parsedDate: new Date(2026, 7, 13, 8, 0) }),
    // Outro paciente na mesma grade:
    ag({ id: 7, "Número": "5551888880000", parsedDate: new Date(2026, 7, 11, 8, 0) }),
  ];

  it("pega só as futuras do mesmo paciente, dia da semana e horário", () => {
    expect(findFutureSiblings(base, lista).map((a) => a.id)).toEqual([2, 3]);
  });

  it("sem telefone, casa pelo nome normalizado", () => {
    const semTel = ag({ id: 10, Nome: "João da Silva", parsedDate: new Date(2026, 7, 4, 8, 0) });
    const lista2 = [semTel, ag({ id: 11, Nome: "joao da silva", parsedDate: new Date(2026, 7, 11, 8, 0) })];
    expect(findFutureSiblings(semTel, lista2).map((a) => a.id)).toEqual([11]);
  });

  it("data inválida na sessão aberta => vazio", () => {
    expect(findFutureSiblings(ag({ id: 20 }), lista)).toEqual([]);
  });
});

describe("sessoesFuturasDoPaciente", () => {
  const agora = new Date(2026, 7, 5, 12, 0); // qua 05/08/2026 12:00
  const aberta = ag({ id: 1, "Número": "5551999990000", Nome: "Maria", parsedDate: new Date(2026, 7, 6, 8, 0) });
  const lista = [
    aberta,
    // Futuras do mesmo paciente em dias/horários DIFERENTES (não é recorrência):
    ag({ id: 2, "Número": "5551999990000", parsedDate: new Date(2026, 7, 11, 9, 30) }),
    ag({ id: 3, "Número": "5551999990000", parsedDate: new Date(2026, 8, 1, 14, 0) }),
    // Passada:
    ag({ id: 4, "Número": "5551999990000", parsedDate: new Date(2026, 7, 4, 8, 0) }),
    // Outro paciente, futura:
    ag({ id: 5, "Número": "5551888880000", parsedDate: new Date(2026, 7, 11, 9, 30) }),
    // Sem data:
    ag({ id: 6, "Número": "5551999990000", parsedDate: null }),
  ];

  it("pega TODAS as futuras do paciente (inclusive a aberta), qualquer dia/horário", () => {
    expect(sessoesFuturasDoPaciente(aberta, lista, agora).map((a) => a.id)).toEqual([1, 2, 3]);
  });

  it("sessão aberta no passado: só as futuras entram", () => {
    const passada = lista[3];
    expect(sessoesFuturasDoPaciente(passada, lista, agora).map((a) => a.id)).toEqual([1, 2, 3]);
  });

  it("sem telefone, casa pelo nome normalizado", () => {
    const semTel = ag({ id: 10, Nome: "João da Silva", parsedDate: new Date(2026, 7, 6, 8, 0) });
    const lista2 = [
      semTel,
      ag({ id: 11, Nome: "joao DA silva", parsedDate: new Date(2026, 7, 20, 8, 0) }),
      ag({ id: 12, Nome: "Outra Pessoa", parsedDate: new Date(2026, 7, 20, 8, 0) }),
    ];
    expect(sessoesFuturasDoPaciente(semTel, lista2, agora).map((a) => a.id)).toEqual([10, 11]);
  });
});

describe("shiftSessao", () => {
  it("terça -> quarta (+1) com novo horário, mantendo a semana", () => {
    const s = ag({ id: 2, parsedDate: new Date(2026, 7, 11, 8, 0) }); // ter 11/08
    expect(shiftSessao(s, 1, "09:30")).toBe("12/08/2026 09:30"); // qua 12/08
  });
  it("terça -> segunda (-1) volta um dia na mesma semana", () => {
    const s = ag({ id: 2, parsedDate: new Date(2026, 7, 11, 8, 0) });
    expect(shiftSessao(s, -1, "08:00")).toBe("10/08/2026 08:00"); // seg 10/08
  });
  it("delta 0 muda só o horário", () => {
    const s = ag({ id: 2, parsedDate: new Date(2026, 7, 11, 8, 0) });
    expect(shiftSessao(s, 0, "10:15")).toBe("11/08/2026 10:15");
  });
});
