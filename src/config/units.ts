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
  busca?: boolean;       // barra de busca de paciente (nome/telefone) na aba Agenda
  editarData?: boolean;  // editar data/horário no modal (+ propagar às sessões futuras)
  addCategorias?: boolean; // cadastro de categorias extras pela UI (tabela painel_categorias)
  addProcedimentos?: boolean; // cadastro de procedimentos pela UI (tabela painel_procedimentos)
  // Cor por profissional (Resp. atendimento): primeiro nome -> cor da paleta
  // (ver src/lib/profissional-cores.ts). Match por prefixo, sem acento/caixa.
  cores?: Record<string, string>;
  horarioUnico?: boolean;      // bloqueia 2+ pacientes no MESMO horário (Data exata)
  webhookAgendamento?: string; // n8n: confirmação por WhatsApp ao criar agendamento pelo painel
  webhookPresenca?: string;    // n8n: NPS (Compareceu) / mensagem de falta (Faltou) ao registrar presença
}

export interface Unit {
  slug: string;
  label: string;
  table: string;
  respStyle: RespStyle;
  config?: UnitConfig;
}

// Config compartilhado das 3 agendas OdontoCompany (geral + 2 unidades).
const ODONTOCOMPANY_CONFIG: UnitConfig = {
  categorias: [
    "Avaliação",
    "Limpeza / Profilaxia",
    "Ortodontia (manutenção)",
    "Canal (Endodontia)",
    "Extração",
    "Implante",
    "Prótese",
    "Estética Dental",
    "Urgência",
  ],
  agendou: true,
  origem: true,
  presenca: true,
  criar: true,
  excluir: true,
  atendentes: true,
  // Pacote Fisio Vida replicado (2026-07-29): busca de paciente, edição de
  // data/horário (com propagação às sessões futuras da recorrência) e cadastro
  // de categorias/procedimentos pela UI. Registros são POR SLUG (painel_*),
  // então cada agenda (VH / SR / geral) tem sua própria lista.
  busca: true,
  editarData: true,
  addCategorias: true,
  addProcedimentos: true,
};

// Fase 1 Face Doctor (pilotos Dourados e Anália Franco, 2026-07-30): só
// recursos ADITIVOS de painel — busca, edição de data/hora, categorias de
// estética + cadastros pela UI (categorias/procedimentos/atendentes) e cor
// por profissional definida no próprio cadastro de atendentes. SEM criar/
// excluir/presença (Fase 2) e SEM tocar nas automações das unidades.
const FACEDOCTOR_FASE1: UnitConfig = {
  categorias: [
    "Avaliação",
    "Agendamento",
    "Botox",
    "Preenchimento",
    "Bioestimulador",
    "Laser / Lavieen",
    "Ultraformer",
    "Microagulhamento",
    "Retorno",
  ],
  busca: true,
  editarData: true,
  addCategorias: true,
  addProcedimentos: true,
  atendentes: true,
};

// Fase 2 Face Doctor (pilotos, 2026-07-30): criar/excluir agendamento pelo
// painel + "Paciente agendou?" + registro de presença/falta. Colunas de
// suporte: migração facedoctor_fase2_pilotos_dourados_analia. Sem `origem`
// (Convênio × Particular não se aplica a estética). Criar pelo painel ainda
// NÃO dispara confirmação/lembrete (os lembretes FD leem a planilha — Fase 3).
const FACEDOCTOR_FASE2: UnitConfig = {
  ...FACEDOCTOR_FASE1,
  agendou: true,
  presenca: true,
  criar: true,
  excluir: true,
};

export const UNITS: Unit[] = [
  // Fase 3 (2026-07-30): criar pelo painel dispara confirmação por WhatsApp via
  // n8n (workflow Agendamento Inteligente da unidade); os crons de lembrete da
  // unidade agora leem o Supabase, então o que nasce/edita aqui entra no lembrete.
  { slug: "analia",                label: "Face Doctor Anália Franco",     table: "Agendamento_Analia",                 respStyle: "accented",
    config: { ...FACEDOCTOR_FASE2,
      webhookAgendamento: "https://aios-n8n-webhook.yspmhc.easypanel.host/webhook/painel_fd_analia" } },
  { slug: "barra",                 label: "Face Doctor Barra da Tijuca",   table: "barradatijucaclinics_agendamento",   respStyle: "ascii" },
  { slug: "botoclinic-riomar",     label: "Botoclinic Riomar",             table: "Agendamento_BotoclinicRiomar",       respStyle: "accented" },
  { slug: "campinas",              label: "Campinas",                      table: "Agendamento_Campinas",               respStyle: "ascii" },
  { slug: "campolim",              label: "Campolim",                      table: "Agendamento_Campolim",               respStyle: "ascii" },
  { slug: "casa-verde",            label: "Casa Verde",                    table: "Agendamento_CasaVerde",              respStyle: "ascii" },
  { slug: "df-plaza",              label: "DF Plaza",                      table: "Agendamento_DF_Plaza",               respStyle: "ascii" },
  { slug: "dourados",              label: "Face Doctor Dourados",          table: "Agendamento_Dourados",               respStyle: "accented",
    config: { ...FACEDOCTOR_FASE2,
      webhookAgendamento: "https://aios-n8n-webhook.yspmhc.easypanel.host/webhook/painel_fd_dourados" } },
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
      busca: true,
      editarData: true,
      addCategorias: true,
      addProcedimentos: true,
      // Cores pedidas pela clínica (2026-07-28). A tabela guarda o nome completo
      // ("Nice oliveira", "Pedro Igo Lopes Ribeiro"...), o match é por prefixo.
      cores: {
        Nice: "vermelho",
        Elis: "amarelo",
        Lenisa: "roxo",
        Pedro: "azul",
        Pietra: "verde",
      },
    } },
  { slug: "campo-belo",            label: "Campo Belo",                    table: "Agendamento_Campo_Belo",             respStyle: "accented" },
  // OdontoCompany: rede odontológica (franquia). Mesmo layout das clínicas de
  // estética; só as categorias do "Tipo" viram procedimentos dentários e a
  // Origem (Convênio/Particular) importa mais aqui (odonto popular).
  // Uma conta, 2 unidades físicas: as agendas por unidade leem VIEWS filtradas
  // pela coluna "Canal" (número WhatsApp da unidade) sobre a MESMA tabela.
  // A view tem DEFAULT em "Canal", então criar pelo painel já marca a unidade.
  // "odontocompany" (tabela crua) = visão geral com tudo, inclusive Canal null.
  { slug: "odontocompany",         label: "OdontoCompany (geral)",         table: "Agendamento_odontocompany",          respStyle: "accented",
    config: ODONTOCOMPANY_CONFIG },
  // Webhooks n8n (workflow HmFP6yiOmuPRw5YJ): agendamento criado no painel ->
  // confirmação pelo canal da unidade; presença registrada -> NPS ou msg de falta.
  // A visão geral NÃO tem webhooks de propósito (linha sem canal definido).
  { slug: "odontocompany-vila-helena", label: "OdontoCompany Vila Helena", table: "vw_agendamento_odonto_vila_helena",  respStyle: "accented",
    config: {
      ...ODONTOCOMPANY_CONFIG,
      horarioUnico: true, // pedido do cliente: 1 paciente por horário na VH
      webhookAgendamento: "https://aios-n8n-webhook.yspmhc.easypanel.host/webhook/painel_odonto_agendamento_vh",
      webhookPresenca: "https://aios-n8n-webhook.yspmhc.easypanel.host/webhook/painel_odonto_presenca",
    } },
  { slug: "odontocompany-santa-rosalia", label: "OdontoCompany Santa Rosália", table: "vw_agendamento_odonto_santa_rosalia", respStyle: "accented",
    config: {
      ...ODONTOCOMPANY_CONFIG,
      webhookAgendamento: "https://aios-n8n-webhook.yspmhc.easypanel.host/webhook/painel_odonto_agendamento_sr",
      webhookPresenca: "https://aios-n8n-webhook.yspmhc.easypanel.host/webhook/painel_odonto_presenca",
    } },
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
