// Registry multi-tenant do Painel de Agendamento.
// Fonte única da verdade: cada unidade -> tabela VIVA no Supabase compartilhado
// (projeto ehlpmukjdknnyhkycncb). Adicionar unidade nova = 1 entrada aqui.
//
// `respStyle` diz qual grafia das colunas de responsável a tabela usa, para o
// hook saber onde ESCREVER (a leitura já faz coalesce de todas as grafias):
//   - "accented" -> "Responsável Agendamento" / "Responsável Atendimento"
//   - "ascii"    -> Responsavel_Agendamento   / Responsavel_Atendimento
// Tabelas que não tinham responsável ganharam o par ASCII na migração aditiva.

export type RespStyle = "accented" | "ascii";

// Config opcional POR UNIDADE. Só as unidades que a declaram ganham os campos
// clínicos extras e as categorias próprias; as demais seguem o comportamento
// padrão (Select "Tipo" com Avaliação/Agendamento, sem presença/origem/agendou).
// Colunas de suporte (Agendou/Origem/Presenca/Justificativa) precisam existir
// na tabela da unidade — ver migração fisio_vida_campos_agendou_origem_presenca.
export interface UnitConfig {
  categorias?: string[]; // substitui as opções fixas do Select "Tipo"
  agendou?: boolean;     // campo "Paciente agendou?" (Sim/Não)
  origem?: boolean;      // campo "Origem do paciente" (Convênio/Particular)
  presenca?: boolean;    // registro de presença/falta (com/sem justificativa)
  criar?: boolean;       // botão "Novo agendamento" (+ recorrência) no painel
  excluir?: boolean;     // botão "Excluir" no modal de detalhes (DELETE no banco)
  atendentes?: boolean;  // cadastro de atendentes (alimenta o dropdown de responsável)
  nameCol?: string;      // coluna física do nome ao INSERIR (default "Nome")
  phoneCol?: string;     // coluna física do telefone ao INSERIR (default "Número")
}

export interface Unit {
  slug: string;
  label: string;
  table: string;
  respStyle: RespStyle;
  config?: UnitConfig;
}

export const UNITS: Unit[] = [
  { slug: "analia",                label: "Face Doctor Anália Franco",     table: "Agendamento_Analia",                 respStyle: "accented" },
  { slug: "barra",                 label: "Face Doctor Barra da Tijuca",   table: "barradatijucaclinics_agendamento",   respStyle: "ascii" },
  { slug: "botoclinic-riomar",     label: "Botoclinic Riomar",             table: "Agendamento_BotoclinicRiomar",       respStyle: "accented" },
  { slug: "campinas",              label: "Campinas",                      table: "Agendamento_Campinas",               respStyle: "ascii" },
  { slug: "campolim",              label: "Campolim",                      table: "Agendamento_Campolim",               respStyle: "ascii" },
  { slug: "casa-verde",            label: "Casa Verde",                    table: "Agendamento_CasaVerde",              respStyle: "ascii" },
  { slug: "df-plaza",              label: "DF Plaza",                      table: "Agendamento_DF_Plaza",               respStyle: "ascii" },
  { slug: "dourados",              label: "Face Doctor Dourados",          table: "Agendamento_Dourados",               respStyle: "accented" },
  { slug: "dr-colageno",           label: "Dr. Colágeno Piracicaba",       table: "Agendamento_DrColageno_Piracicaba",  respStyle: "ascii" },
  { slug: "dra-ligia",             label: "Dra. Lígia",                    table: "Agendamento_DraLigia",               respStyle: "accented" },
  { slug: "duque-de-caxias",       label: "Duque de Caxias",               table: "Agendamento_Duque de Caxias",        respStyle: "ascii" },
  { slug: "elevar",                label: "Elevar",                        table: "Agendamento_Elevar",                 respStyle: "accented" },
  { slug: "estudio-mais",          label: "Estúdio Mais",                  table: "Agendamento_Estudio Mais",           respStyle: "ascii" },
  { slug: "harmonize",             label: "Harmonize",                     table: "Agendamento_Harmonize",              respStyle: "accented" },
  { slug: "ibirapuera",            label: "Ibirapuera",                    table: "Agendamento_Ibirapuera",             respStyle: "ascii" },
  { slug: "itupeva",               label: "Face Doctor Itupeva",           table: "itupevaclinics_agendamento",         respStyle: "ascii" },
  { slug: "londrina",              label: "Face Doctor Londrina",          table: "Agendamento_Londrina",               respStyle: "ascii" },
  { slug: "macae",                 label: "Face Doctor Macaé",             table: "Agendamento_Macae",                  respStyle: "accented" },
  { slug: "perdizes",              label: "Perdizes",                      table: "Agendamento_Perdizes",               respStyle: "accented" },
  { slug: "recreio",               label: "Recreio dos Bandeirantes",      table: "Agendamento_Recreiodosbandeirantes", respStyle: "accented" },
  { slug: "smile-skin",            label: "Smile Skin",                    table: "Agendamento_Smile Skin",             respStyle: "ascii" },
  { slug: "vanda",                 label: "Vanda Santos",                  table: "Agendamento_Vanda",                  respStyle: "accented" },
  { slug: "vila-leopoldina",       label: "Vila Leopoldina",               table: "Agendamento_VilaLeopoldina",         respStyle: "ascii" },
  { slug: "botoclinic-aracatuba",  label: "Botoclinic Araçatuba",          table: "Agendamento_botoclinic_araçatuba",   respStyle: "accented" },
  { slug: "botoclinic-sao-carlos", label: "Botoclinic São Carlos",         table: "Agendamento_botoclinic_são_carlos",  respStyle: "accented" },
  { slug: "ef-harmony",            label: "EF Harmony",                    table: "vw_agendamento_ef_harmony",          respStyle: "accented" },
  { slug: "ladydai",               label: "Lady Dai",                      table: "Agendamento_ladydai",                respStyle: "accented" },
  { slug: "fisio-vida",            label: "Fisio Vida",                    table: "Agendamento_Fisio_Vida",             respStyle: "ascii",
    config: {
      categorias: [
        "Avaliação",
        "Atividade Reflexa",
        "RPG",
        "Pilates",
        "Reabilitação Perineal",
        "Terapia Neural",
        "Reabilitação Osteomuscular",
        "Atendimento Domiciliar",
      ],
      agendou: true,
      origem: true,
      presenca: true,
      criar: true,
      excluir: true,
      atendentes: true,
      nameCol: "Noem",
      phoneCol: "Telefone",
    } },
  { slug: "campo-belo",            label: "Campo Belo",                    table: "Agendamento_Campo_Belo",             respStyle: "accented" },
];

export function getUnitBySlug(slug: string | undefined): Unit | undefined {
  if (!slug) return undefined;
  return UNITS.find((u) => u.slug === slug);
}

// Resolve uma unidade pelo hostname (subdomínio por cliente). Suporta:
//   - <slug>.<dominio>            ex: macae.agenda.aios.com
//   - agendamento-<slug>.vercel.app  (aliases .vercel.app por unidade)
// Retorna undefined nos hosts "raiz" (apex, www, o domínio compartilhado,
// localhost) — nesses casos a rota "/" mostra a landing com todas as unidades.
export function getUnitByHost(hostname: string | undefined): Unit | undefined {
  if (!hostname) return undefined;
  const host = hostname.toLowerCase();
  if (
    host === "agendamentos-aios.vercel.app" ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.split(".")[0] === "www"
  ) {
    return undefined;
  }
  const first = host.split(".")[0];
  const candidate = first.startsWith("agendamento-") ? first.slice("agendamento-".length) : first;
  return getUnitBySlug(candidate);
}
