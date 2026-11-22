import { describe, it, expect } from "vitest";
import { descreveComparecimento } from "./comparecimento-info";

const AGORA = new Date(2026, 10, 20, 12, 0); // 20/11/2026 12:00

describe("descreveComparecimento", () => {
  it("resposta do paciente é creditada ao paciente", () => {
    const i = descreveComparecimento({
      Presenca: "Compareceu",
      Comparecimento_Perguntado_Em: "2026-11-19T19:00:27.84-03:00",
      Comparecimento_Resposta: "sim",
      Comparecimento_Respondido_Em: "2026-11-19T19:09:00-03:00",
    }, AGORA);
    expect(i.doPaciente).toBe(true);
    expect(i.texto).toContain("próprio paciente");
    expect(i.texto).toContain("19/11 às 19:09");
  });

  it("falta respondida pelo paciente", () => {
    const i = descreveComparecimento({
      Presenca: "Faltou (não justificada)",
      Comparecimento_Resposta: "nao",
    }, AGORA);
    expect(i.doPaciente).toBe(true);
    expect(i.texto).toContain("não conseguiu ir");
  });

  it("presença sem resposta do bot = recepção", () => {
    const i = descreveComparecimento({ Presenca: "Compareceu" }, AGORA);
    expect(i.doPaciente).toBe(false);
    expect(i.texto).toContain("recepção");
  });

  it("perguntado e sem resposta pede marcação manual", () => {
    const i = descreveComparecimento({
      Comparecimento_Perguntado_Em: "2026-11-19T19:00:00-03:00",
    }, AGORA);
    expect(i.tom).toBe("warning");
    expect(i.texto).toContain("ainda não respondeu");
  });

  it("consulta futura: explica o fluxo em vez de cobrar", () => {
    const i = descreveComparecimento({ parsedDate: new Date(2026, 10, 20, 15, 0) }, AGORA);
    expect(i.tom).toBe("muted");
    expect(i.texto).toContain("1h depois");
  });

  it("consulta passada sem pergunta nenhuma cobra marcação", () => {
    const i = descreveComparecimento({ parsedDate: new Date(2026, 10, 20, 9, 0) }, AGORA);
    expect(i.tom).toBe("warning");
    expect(i.texto).toContain("não chegou a perguntar");
  });
});
