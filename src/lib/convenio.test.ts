import { describe, it, expect } from "vitest";
import {
  CONVENIO_A_IDENTIFICAR,
  CONVENIO_SEM_INFO,
  compilarRegras,
  convenioMarcado,
  cruzadaParaCsv,
  cruzarProfissionalConvenio,
  derivarConvenios,
} from "./convenio";
import type { Agendamento } from "@/hooks/useAgendamentos";
import type { RegraConvenio } from "@/config/units";

// Regras REAIS da Fisio Vida (units.ts). A ordem é a do config: AFISVEC e
// Banco Central antes de Cabergs, que é o marcador mais genérico.
const REGRAS: RegraConvenio[] = [
  { nome: "AFISVEC", marcadores: ["afisvec"] },
  { nome: "Banco Central", marcadores: ["banco central", "bc ", "bc5000"] },
  { nome: "Cabergs", marcadores: ["cabergs", "cabers", "c-"] },
  { nome: "Particular", marcadores: ["particular", "p - ", "pro4"] },
];

const C = compilarRegras(REGRAS);

// Linha mínima: só os campos que a derivação lê.
function ev(p: Partial<Agendamento> & { id: number }): Agendamento {
  return {
    Procedimento: null,
    "Número": null,
    Nome: null,
    Origem: null,
    Presenca: null,
    Responsavel_Atendimento: null,
    ...p,
  } as Agendamento;
}

describe("convenioMarcado — grafias que existem de verdade na base", () => {
  it("catálogo da clínica", () => {
    expect(convenioMarcado("C- 20103115 Atividade Reflexa (2Xsemana)", C)).toBe("Cabergs");
    expect(convenioMarcado("AFISVEC  20103514  (Felipe Goebel)", C)).toBe("AFISVEC");
    expect(convenioMarcado("BC 5000016002 - FISIO PAT. DIVERSAS (TENS OOU FES)", C)).toBe("Banco Central");
    expect(convenioMarcado("BC5000016002 -  (TENS OOU FES) 1X NA SEMANA", C)).toBe("Banco Central");
    expect(convenioMarcado("P - Sessão + avaliação", C)).toBe("Particular");
    expect(convenioMarcado("Pro4 - sessões avulsas", C)).toBe("Particular");
  });

  it("digitação livre: espaço sobrando, caixa trocada e erro de grafia", () => {
    expect(convenioMarcado(" cabergs 3115", C)).toBe("Cabergs");
    expect(convenioMarcado("3115 cabergs", C)).toBe("Cabergs");
    expect(convenioMarcado("cabers 3484", C)).toBe("Cabergs"); // sem o "g"
    expect(convenioMarcado("BANCO  CENTRAL", C)).toBe("Banco Central"); // 2 espaços
    expect(convenioMarcado("PARTICULAR", C)).toBe("Particular");
    expect(convenioMarcado("NÃO AUTENTICAR C- 20103115 Atividade Reflexa", C)).toBe("Cabergs");
  });

  it("o código do procedimento NÃO identifica convênio sozinho", () => {
    // 20103514 aparece em "C- 20103514" e em "AFISVEC 20103514": quem decide é
    // o marcador, nunca o número.
    expect(convenioMarcado("3115", C)).toBeNull();
    expect(convenioMarcado("20103514", C)).toBeNull();
    expect(convenioMarcado("3115  auten . todos dias", C)).toBeNull();
    expect(convenioMarcado("Pilates", C)).toBeNull();
    expect(convenioMarcado("", C)).toBeNull();
    expect(convenioMarcado(null, C)).toBeNull();
  });

  it("marcador não casa no meio de palavra", () => {
    expect(convenioMarcado("abc 123", C)).toBeNull();
    expect(convenioMarcado("pos-cirurgico", C)).toBeNull();
    expect(convenioMarcado("abcabergs", C)).toBeNull();
  });

  it("sem regras no config, ninguém é classificado", () => {
    expect(convenioMarcado("C- 20103115", compilarRegras(undefined))).toBeNull();
  });
});

describe("derivarConvenios — as 3 camadas", () => {
  it("camada 2: código solto herda o convênio do próprio paciente", () => {
    const eventos = [
      ev({ id: 1, "Número": "5551999990000", Procedimento: " cabergs 3115" }),
      ev({ id: 2, "Número": "5551999990000", Procedimento: "3115" }),
      ev({ id: 3, "Número": "5551988887777", Procedimento: "AFISVEC  20103514" }),
      ev({ id: 4, "Número": "5551988887777", Procedimento: "3115" }),
    ];
    const m = derivarConvenios(eventos, REGRAS);
    expect(m.get(2)).toBe("Cabergs");
    // o MESMO texto "3115" cai em AFISVEC aqui: quem manda é o paciente
    expect(m.get(4)).toBe("AFISVEC");
  });

  it("paciente sem telefone propaga pelo nome", () => {
    const eventos = [
      ev({ id: 1, Nome: "Maria Souza", Procedimento: "cabergs" }),
      ev({ id: 2, Nome: "maria  souza", Procedimento: "3115" }),
    ];
    expect(derivarConvenios(eventos, REGRAS).get(2)).toBe("Cabergs");
  });

  it("paciente com 2 convênios: vence o dominante", () => {
    const eventos = [
      ev({ id: 1, "Número": "551", Procedimento: "cabergs" }),
      ev({ id: 2, "Número": "551", Procedimento: "cabergs" }),
      ev({ id: 3, "Número": "551", Procedimento: "afisvec" }),
      ev({ id: 4, "Número": "551", Procedimento: "3115" }),
    ];
    expect(derivarConvenios(eventos, REGRAS).get(4)).toBe("Cabergs");
  });

  it("camada 3: sem marcador e sem histórico, cai no campo Origem", () => {
    const eventos = [
      ev({ id: 1, "Número": "5552", Procedimento: "Pilates", Origem: "Particular" }),
      ev({ id: 2, "Número": "5553", Procedimento: "RPG", Origem: "Convênio" }),
      ev({ id: 3, "Número": "5554", Procedimento: "tto coluna" }),
    ];
    const m = derivarConvenios(eventos, REGRAS);
    expect(m.get(1)).toBe("Particular");
    expect(m.get(2)).toBe(CONVENIO_A_IDENTIFICAR); // nunca chuta um nome
    expect(m.get(3)).toBe(CONVENIO_SEM_INFO);
  });

  it("marcador da linha vence a Origem divergente", () => {
    const eventos = [ev({ id: 1, "Número": "5555", Procedimento: "C- 20103115", Origem: "Particular" })];
    expect(derivarConvenios(eventos, REGRAS).get(1)).toBe("Cabergs");
  });

  it("toda linha recebe um balde, e sem config o mapa fica vazio", () => {
    const eventos = [ev({ id: 1 }), ev({ id: 2, Procedimento: "cabergs" })];
    expect(derivarConvenios(eventos, REGRAS).size).toBe(2);
    expect(derivarConvenios(eventos, undefined).size).toBe(0);
    expect(derivarConvenios(eventos, []).size).toBe(0);
  });
});

describe("cruzarProfissionalConvenio", () => {
  const eventos = [
    ev({ id: 1, Responsavel_Atendimento: "Nice oliveira", Procedimento: "cabergs" }),
    ev({ id: 2, Responsavel_Atendimento: "Nice oliveira", Procedimento: "cabergs" }),
    ev({ id: 3, Responsavel_Atendimento: "Nice oliveira", Procedimento: "afisvec" }),
    ev({ id: 4, Responsavel_Atendimento: "Elis Regina Rocha", Procedimento: "cabergs" }),
    ev({ id: 5, Responsavel_Atendimento: null, Procedimento: "RPG", Origem: "Convênio" }),
  ];
  const cruzada = cruzarProfissionalConvenio(eventos, derivarConvenios(eventos, REGRAS));

  it("colunas por volume, com o balde honesto no fim", () => {
    expect(cruzada.colunas).toEqual(["Cabergs", "AFISVEC", CONVENIO_A_IDENTIFICAR]);
  });

  it("linhas por volume e linha sem responsável identificada", () => {
    expect(cruzada.linhas.map((l) => l.nome)).toEqual(["Nice oliveira", "Elis Regina Rocha", "Sem responsável"]);
    expect(cruzada.linhas[0].celulas).toEqual([2, 1, 0]);
    expect(cruzada.linhas[0].total).toBe(3);
  });

  it("os totais fecham com o número de linhas", () => {
    expect(cruzada.totais).toEqual([3, 1, 1]);
    expect(cruzada.total).toBe(eventos.length);
    expect(cruzada.linhas.reduce((a, l) => a + l.total, 0)).toBe(eventos.length);
  });

  it("período sem nada devolve tabela vazia, não quebra", () => {
    const vazia = cruzarProfissionalConvenio([], new Map());
    expect(vazia).toEqual({ colunas: [], linhas: [], totais: [], total: 0 });
  });
});

describe("cruzadaParaCsv", () => {
  it("cabeçalho, linhas e total, separados por ponto e vírgula", () => {
    const csv = cruzadaParaCsv(cruzarProfissionalConvenio([], new Map()), "Profissional");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Profissional";"Total"');
    expect(csv.trim().endsWith('"Total";"0"')).toBe(true);
  });

  it("escapa aspas do nome em vez de quebrar a coluna", () => {
    const eventos = [ev({ id: 1, Responsavel_Atendimento: 'Ana "Nina" Souza', Procedimento: "cabergs" })];
    const csv = cruzadaParaCsv(
      cruzarProfissionalConvenio(eventos, derivarConvenios(eventos, REGRAS)),
      "Profissional",
    );
    expect(csv).toContain('"Ana ""Nina"" Souza"');
  });
});
