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

  it("falta justificada -> tom warning (âmbar), preserva o rótulo", () => {
    const s = deriveStatus(ev({ Presenca: PRESENCA.FALTOU_JUSTIFICADA }));
    expect(s.key).toBe("faltou_justificada");
    expect(s.tone).toBe("warning");
    expect(s.label).toBe(PRESENCA.FALTOU_JUSTIFICADA);
  });

  it("falta não justificada -> tom danger (vermelho), preserva o rótulo", () => {
    const s = deriveStatus(ev({ Presenca: PRESENCA.FALTOU_NAO_JUSTIFICADA }));
    expect(s.key).toBe("faltou");
    expect(s.tone).toBe("danger");
    expect(s.label).toBe(PRESENCA.FALTOU_NAO_JUSTIFICADA);
    expect(deriveStatus(ev({ Presenca: "Faltou (nao justificada)" })).tone).toBe("danger");
    expect(deriveStatus(ev({ Presenca: "Faltou" })).tone).toBe("danger");
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

// Fluxo de comparecimento (config.comparecimento) — OdontoCompany. O que esta
// cadeia tem de garantir: NUNCA mais devolver "Confirmado"/"Pendente" na agenda
// da clínica, porque esses dois rótulos saíam da coluna `Confirmação` (que só
// diz se a linha nasceu pela automação do WhatsApp) e foram lidos como "o
// paciente confirmou" (queixa do dono em 19/11/2026).
describe("deriveStatus — fluxo de comparecimento", () => {
  const AGORA = new Date(2026, 10, 20, 12, 0);
  const comp = (o: Partial<S> & { parsedDate?: Date | null; Cancelamento?: string | null; Comparecimento_Perguntado_Em?: string | null }) =>
    deriveStatus({ Presenca: null, Agendou: null, "Confirmação": null, ...o }, { comparecimento: true, now: AGORA });

  it("Confirmação=OK não vira mais Confirmado: a consulta é futura => Agendado", () => {
    const s = comp({ "Confirmação": "OK", parsedDate: new Date(2026, 10, 20, 15, 0) });
    expect(s.key).toBe("agendado");
    expect(s.label).toBe("Agendado");
  });

  it("Agendou='IA V3' (lixo da IA) é ignorado", () => {
    expect(comp({ Agendou: "IA V3", parsedDate: new Date(2026, 10, 21, 9, 0) }).key).toBe("agendado");
  });

  it("falta aparece como 'Faltou' seco, justificada ou não", () => {
    expect(comp({ Presenca: PRESENCA.FALTOU_JUSTIFICADA }).label).toBe("Faltou");
    expect(comp({ Presenca: PRESENCA.FALTOU_NAO_JUSTIFICADA }).label).toBe("Faltou");
    // o tom continua distinguindo (âmbar x vermelho)
    expect(comp({ Presenca: PRESENCA.FALTOU_JUSTIFICADA }).tone).toBe("warning");
    expect(comp({ Presenca: PRESENCA.FALTOU_NAO_JUSTIFICADA }).tone).toBe("danger");
  });

  it("Compareceu usa o tom 'presente' (verde de verdade, não o roxo do tema)", () => {
    // Sem isto "Compareceu" e "Agendado" sairiam da mesma cor: os tokens green-*
    // do app apontam para o roxo da marca.
    expect(comp({ Presenca: PRESENCA.COMPARECEU }).tone).toBe("presente");
    expect(comp({ parsedDate: new Date(2026, 10, 21, 9, 0) }).tone).toBe("primary");
  });

  it("presença vence cancelamento e pergunta do bot", () => {
    const s = comp({ Presenca: PRESENCA.COMPARECEU, Cancelamento: "paciente pediu", Comparecimento_Perguntado_Em: "x" });
    expect(s.key).toBe("compareceu");
  });

  it("Cancelamento com motivo => Cancelado; string vazia não cancela", () => {
    expect(comp({ Cancelamento: "paciente pediu", parsedDate: new Date(2026, 10, 19, 9, 0) }).key).toBe("cancelado");
    expect(comp({ Cancelamento: "", parsedDate: new Date(2026, 10, 19, 9, 0) }).key).toBe("a_marcar");
  });

  it("perguntado pelo bot e sem resposta => Aguardando resposta", () => {
    const s = comp({ Comparecimento_Perguntado_Em: "2026-11-19T19:00:00-03:00", parsedDate: new Date(2026, 10, 19, 17, 0) });
    expect(s.key).toBe("aguardando");
    expect(s.label).toBe("Aguardando resposta");
  });

  it("dentro da folga de 1h ainda é Agendado (paciente pode estar na cadeira)", () => {
    expect(comp({ parsedDate: new Date(2026, 10, 20, 11, 30) }).key).toBe("agendado");
  });

  it("passou de 1h e ninguém registrou => Marcar presença", () => {
    const s = comp({ parsedDate: new Date(2026, 10, 20, 10, 0) });
    expect(s.key).toBe("a_marcar");
    expect(s.label).toBe("Marcar presença");
  });

  it("sem data nenhuma não cobra marcação", () => {
    expect(comp({ parsedDate: null }).key).toBe("agendado");
  });

  it("nenhum status do fluxo é Confirmado ou Pendente", () => {
    const casos = [
      comp({ "Confirmação": "OK", parsedDate: new Date(2026, 10, 21, 9, 0) }),
      comp({ "Confirmação": null, parsedDate: new Date(2026, 10, 19, 9, 0) }),
      comp({ Agendou: "Sim", parsedDate: new Date(2026, 10, 19, 9, 0) }),
    ];
    for (const c of casos) {
      expect(["confirmado", "pendente"]).not.toContain(c.key);
    }
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
