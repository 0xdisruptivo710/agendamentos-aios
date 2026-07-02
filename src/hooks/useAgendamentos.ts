import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { compareAgendamentoDates } from "@/lib/agendamento-date";
import { useUnit } from "@/context/UnitContext";
import type { RespStyle } from "@/config/units";

// Shape canônico que TODOS os componentes consomem. A leitura normaliza as
// variações de nome de coluna entre as ~27 tabelas (3 grafias de responsável,
// Cancelado vs Cancelamento) para este formato único.
export interface Agendamento {
  id: number;
  created_at: string;
  Data: string | null;
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
  return {
    id: row.id,
    created_at: row.created_at,
    Data: row["Data"] ?? null,
    Nome: row["Nome"] ?? null,
    "Número": row["Número"] ?? null,
    Anotações: row["Anotações"] ?? null,
    Confirmação: row["Confirmação"] ?? null,
    "1 Dia antes": row["1 Dia antes"] ?? null,
    "No dia": row["No dia"] ?? null,
    Valor: row["Valor"] ?? null,
    Responsavel_Agendamento: pick(row, ["Responsavel_Agendamento", "Responsável Agendamento", "Responsavel Agendamento"]),
    Responsavel_Atendimento: pick(row, ["Responsavel_Atendimento", "Responsável Atendimento", "Responsavel Atendimento"]),
    Tipo: row["Tipo"] ?? null,
    Procedimento: row["Procedimento"] ?? null,
    Cancelamento: pick(row, ["Cancelamento", "Cancelado"]),
  };
}

// A escrita mira a coluna que a tabela REALMENTE tem (respStyle do registry),
// para não criar coluna duplicada nem quebrar a automação que já escreve lá.
function toRow(updates: Partial<Agendamento>, respStyle: RespStyle): Record<string, any> {
  const row: Record<string, any> = {};
  if ("Anotações" in updates) row["Anotações"] = updates["Anotações"];
  if ("Valor" in updates) row["Valor"] = updates.Valor;
  if ("Tipo" in updates) row["Tipo"] = updates.Tipo;
  if ("Procedimento" in updates) row["Procedimento"] = updates.Procedimento;
  if ("Responsavel_Agendamento" in updates) row[RESP_AG[respStyle]] = updates.Responsavel_Agendamento;
  if ("Responsavel_Atendimento" in updates) row[RESP_AT[respStyle]] = updates.Responsavel_Atendimento;
  return row;
}

export function useAgendamentos() {
  const unit = useUnit();
  return useQuery({
    queryKey: ["agendamentos", unit.table],
    queryFn: async () => {
      const { data, error } = await supabase.from(unit.table).select("*");
      if (error) throw error;
      return (data as Record<string, any>[])
        .map(fromRow)
        .sort((a, b) => compareAgendamentoDates(a.Data, b.Data));
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
