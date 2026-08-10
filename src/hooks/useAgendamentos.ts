import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dayKeyFromDate, parseAgendamentoDate } from "@/lib/agendamento-date";
import { useUnit } from "@/context/UnitContext";
import type { RespStyle } from "@/config/units";

// Shape canônico que TODOS os componentes consomem. A leitura normaliza as
// variações de nome de coluna entre as ~27 tabelas (3 grafias de responsável,
// Cancelado vs Cancelamento) para este formato único.
export interface Agendamento {
  id: number;
  created_at: string;
  Data: string | null;
  // Pré-computados no fetch (parse de data é caro; rodar 1x por linha, nunca no render):
  parsedDate: Date | null;
  dayKey: string | null; // "yyyy-MM-dd" p/ agrupamento e comparação com <input type="date">
  Nome: string | null;
  "Número": string | null;
  Anotações: string | null;
  Confirmação: string | null;
  "1 Dia antes": string | null;
  "No dia": string | null;
  Valor: number | null;
  Responsavel_Agendamento: string | null;
  Responsavel_Atendimento: string | null;
  Tipo: string | null;
  Procedimento: string | null;
  Cancelamento: string | null;
  // Campos clínicos por unidade (só existem nas tabelas cuja unidade os habilita
  // em config; nas demais vêm undefined -> null e nunca são escritos). Ver units.ts.
  Agendou: string | null;        // "Sim"/"Não": paciente confirmou o horário
  Origem: string | null;         // "Convênio"/"Particular"
  Presenca: string | null;       // "Compareceu"/"Faltou (justificada)"/"Faltou (não justificada)"
  Justificativa: string | null;  // texto livre da falta justificada
  // Número WhatsApp da unidade (só nas tabelas multi-unidade, hoje OdontoCompany).
  // Somente leitura: quem escreve é o DEFAULT da view por unidade. É o que
  // identifica a unidade nos webhooks — o slug não serve, porque a agenda geral
  // atende as duas clínicas.
  Canal: string | null;
  // Dados de paciente exigidos pelo POST /agendar do Infosoft (só nas unidades
  // com config.infosoft; coletados opcionalmente no criar).
  CPF: string | null;
  Nascimento: string | null; // "yyyy-MM-dd" (input type=date)
  Sexo: string | null;       // "F" | "M"
  Email: string | null;
  // Espelho Infosoft (só unidades com config.infosoft; quem escreve é o n8n):
  // código da autorização no ilife e resultado do espelho
  // ("OK" | "ERRO: motivo" | "PENDENTE: faltas" | null = ainda processando).
  cod_autorizacao: string | null;
  infosoft_status: string | null;
}

const RESP_AG: Record<RespStyle, string> = {
  accented: "Responsável Agendamento",
  ascii: "Responsavel_Agendamento",
};
const RESP_AT: Record<RespStyle, string> = {
  accented: "Responsável Atendimento",
  ascii: "Responsavel_Atendimento",
};

// Retorna o primeiro valor presente e não-vazio entre as grafias candidatas.
function pick(row: Record<string, any>, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return null;
}

function fromRow(row: Record<string, any>): Agendamento {
  const parsedDate = parseAgendamentoDate(row["Data"] ?? null);
  return {
    id: row.id,
    created_at: row.created_at,
    Data: row["Data"] ?? null,
    parsedDate,
    dayKey: parsedDate ? dayKeyFromDate(parsedDate) : null,
    // Fisio Vida usa grafias proprias (Noem/Telefone/Confirmado1); coalesce com
    // prioridade para o nome canonico, entao as demais tabelas nao sao afetadas.
    Nome: pick(row, ["Nome", "Noem"]),
    "Número": pick(row, ["Número", "Telefone"]),
    Anotações: row["Anotações"] ?? null,
    Confirmação: pick(row, ["Confirmação", "Confirmado1"]),
    "1 Dia antes": row["1 Dia antes"] ?? null,
    "No dia": row["No dia"] ?? null,
    Valor: row["Valor"] ?? null,
    Responsavel_Agendamento: pick(row, ["Responsavel_Agendamento", "Responsável Agendamento", "Responsavel Agendamento"]),
    Responsavel_Atendimento: pick(row, ["Responsavel_Atendimento", "Responsável Atendimento", "Responsavel Atendimento"]),
    Tipo: row["Tipo"] ?? null,
    Procedimento: row["Procedimento"] ?? null,
    Cancelamento: pick(row, ["Cancelamento", "Cancelado"]),
    Agendou: row["Agendou"] ?? null,
    Origem: row["Origem"] ?? null,
    Presenca: row["Presenca"] ?? null,
    Justificativa: row["Justificativa"] ?? null,
    Canal: row["Canal"] ?? null,
    CPF: row["CPF"] ?? null,
    Nascimento: row["Nascimento"] ?? null,
    Sexo: row["Sexo"] ?? null,
    Email: row["Email"] ?? null,
    cod_autorizacao: row["cod_autorizacao"] ?? null,
    infosoft_status: row["infosoft_status"] ?? null,
  };
}

// A escrita mira a coluna que a tabela REALMENTE tem (respStyle do registry),
// para não criar coluna duplicada nem quebrar a automação que já escreve lá.
function toRow(updates: Partial<Agendamento>, respStyle: RespStyle): Record<string, any> {
  const row: Record<string, any> = {};
  // Data no formato texto da tabela ("dd/MM/yyyy HH:mm") — só o modal de edição
  // de data/horário (config.editarData) envia esta chave.
  if ("Data" in updates) row["Data"] = updates.Data;
  if ("Anotações" in updates) row["Anotações"] = updates["Anotações"];
  if ("Valor" in updates) row["Valor"] = updates.Valor;
  if ("Tipo" in updates) row["Tipo"] = updates.Tipo;
  if ("Procedimento" in updates) row["Procedimento"] = updates.Procedimento;
  if ("Responsavel_Agendamento" in updates) row[RESP_AG[respStyle]] = updates.Responsavel_Agendamento;
  if ("Responsavel_Atendimento" in updates) row[RESP_AT[respStyle]] = updates.Responsavel_Atendimento;
  // Campos clínicos: nomes ASCII únicos (sem variação por respStyle). Só entram
  // no update quando a unidade os habilitou (o modal só envia essas chaves nesse
  // caso), então nenhuma outra tabela recebe colunas que não tem.
  if ("Agendou" in updates) row["Agendou"] = updates.Agendou;
  if ("Origem" in updates) row["Origem"] = updates.Origem;
  if ("Presenca" in updates) row["Presenca"] = updates.Presenca;
  if ("Justificativa" in updates) row["Justificativa"] = updates.Justificativa;
  return row;
}

// O PostgREST corta a resposta em 1000 linhas por request (comprovado:
// Content-Range 0-999/4731 na Fisio Vida). Sem paginação, tabelas grandes
// perdiam tudo acima das 1000 primeiras — por isso buscamos em páginas até
// vir página incompleta. O .order("id") é obrigatório: sem ordem estável,
// .range() pode repetir/pular linhas entre páginas.
const PAGE_SIZE = 1000;

export function useAgendamentos() {
  const unit = useUnit();
  return useQuery({
    queryKey: ["agendamentos", unit.table],
    queryFn: async () => {
      const rows: Record<string, any>[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from(unit.table)
          .select("*")
          .order("id", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE_SIZE) break;
      }
      return rows
        .map(fromRow)
        .sort(
          (a, b) =>
            (a.parsedDate?.getTime() ?? Number.POSITIVE_INFINITY) -
            (b.parsedDate?.getTime() ?? Number.POSITIVE_INFINITY),
        );
    },
  });
}

// Dados para criar 1+ agendamentos (uma linha por sessão). As datas já vêm no
// formato da tabela ("dd/MM/yyyy HH:mm"); o telefone já normalizado (55+DDD+nº).
export interface NewAgendamentoInput {
  nome: string;
  telefone: string;
  datas: string[];
  tipo?: string | null;
  procedimento?: string | null;
  origem?: string | null;
  responsavelAtendimento?: string | null;
  // Dados de paciente do espelho Infosoft (config.infosoft) — o modal só os
  // envia nessas unidades, então nenhuma outra tabela recebe as colunas.
  cpf?: string | null;
  nascimento?: string | null;
  sexo?: string | null;
  email?: string | null;
}

// Insere as linhas uma a uma (tolerante a duplicata: o índice único
// uniq_fisiovida_telefone_data rejeita o mesmo (Telefone,Data) com código 23505,
// que é contado como "pulado" em vez de quebrar o lote). As colunas físicas de
// nome/telefone vêm do config da unidade (ex.: Fisio Vida usa Noem/Telefone).
export function useCreateAgendamentos() {
  const unit = useUnit();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewAgendamentoInput) => {
      const nameCol = unit.config?.nameCol ?? "Nome";
      const phoneCol = unit.config?.phoneCol ?? "Número";
      const base: Record<string, any> = {
        [nameCol]: input.nome,
        [phoneCol]: input.telefone,
      };
      if (input.tipo) base["Tipo"] = input.tipo;
      if (input.procedimento) base["Procedimento"] = input.procedimento;
      if (input.origem) base["Origem"] = input.origem;
      if (input.responsavelAtendimento) base[RESP_AT[unit.respStyle]] = input.responsavelAtendimento;
      if (input.cpf) base["CPF"] = input.cpf;
      if (input.nascimento) base["Nascimento"] = input.nascimento;
      if (input.sexo) base["Sexo"] = input.sexo;
      if (input.email) base["Email"] = input.email;

      let inserted = 0;
      let skipped = 0;
      let lastError: string | null = null;
      for (const data of input.datas) {
        const { error } = await supabase.from(unit.table).insert({ ...base, Data: data });
        if (!error) {
          inserted++;
        } else if ((error as { code?: string }).code === "23505") {
          skipped++; // (Telefone, Data) já existe — pula sem quebrar o lote
        } else {
          lastError = error.message;
        }
      }
      if (inserted === 0 && lastError) throw new Error(lastError);
      return { inserted, skipped };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agendamentos", unit.table] });
    },
  });
}

// Exclui um agendamento pelo id (só unidades com config.excluir; a policy anon de
// DELETE existe apenas na tabela dessas unidades).
export function useDeleteAgendamento() {
  const unit = useUnit();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from(unit.table).delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agendamentos", unit.table] });
    },
  });
}

// Exclui VÁRIOS agendamentos de uma vez (botão "Excluir todos os futuros deste
// paciente" — config.excluirFuturos). Um único DELETE ... IN (ids): os ids são
// calculados no cliente sobre a lista já carregada, porque "futuro" não dá para
// comparar no servidor (Data é texto "dd/MM/yyyy HH:mm").
export function useDeleteAgendamentos() {
  const unit = useUnit();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: number[]) => {
      const { error } = await supabase.from(unit.table).delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agendamentos", unit.table] });
    },
  });
}

// Reagenda várias sessões de uma vez (edição de data/horário propagada às
// sessões futuras da recorrência — config.editarData). Atualiza linha a linha;
// colisão com o índice único (Telefone, Data) vira "conflito" em vez de quebrar
// o lote, para o modal informar quantas não puderam ser movidas.
export function useReagendarSessoes() {
  const unit = useUnit();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: { id: number; data: string }[]) => {
      let updated = 0;
      let conflicts = 0;
      let lastError: string | null = null;
      for (const item of items) {
        const { error } = await supabase
          .from(unit.table)
          .update({ Data: item.data })
          .eq("id", item.id);
        if (!error) {
          updated++;
        } else if ((error as { code?: string }).code === "23505") {
          conflicts++; // já existe sessão desse paciente nesse (Telefone, Data)
        } else {
          lastError = error.message;
        }
      }
      if (updated === 0 && conflicts === 0 && lastError) throw new Error(lastError);
      return { updated, conflicts };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agendamentos", unit.table] });
    },
  });
}

export function useUpdateAgendamento() {
  const unit = useUnit();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Agendamento> }) => {
      const { data, error } = await supabase
        .from(unit.table)
        .update(toRow(updates, unit.respStyle))
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data ? fromRow(data as Record<string, any>) : null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agendamentos", unit.table] });
    },
  });
}
