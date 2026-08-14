import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnit } from "@/context/UnitContext";
import type { OpcoesBloqueio } from "@/lib/agenda-bloqueios";

// Feriados PRÓPRIOS da unidade (tabela painel_feriados) — só o que não é
// nacional: padroeiro, emenda, recesso. Os nacionais saem calculados em
// src/lib/agenda-bloqueios.ts e não passam por aqui.
export interface Feriado {
  id: number;
  data: string;      // "yyyy-MM-dd" (date do Postgres)
  descricao: string | null;
}

export function useFeriados() {
  const unit = useUnit();
  return useQuery({
    queryKey: ["feriados", unit.slug],
    enabled: !!unit.config?.feriados,
    queryFn: async (): Promise<Feriado[]> => {
      const { data, error } = await supabase
        .from("painel_feriados")
        .select("id, data, descricao")
        .eq("unidade", unit.slug)
        .order("data", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Feriado[];
    },
  });
}

export function useCreateFeriado() {
  const unit = useUnit();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data, descricao }: { data: string; descricao: string }) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error("Data inválida");
      const { error } = await supabase
        .from("painel_feriados")
        .insert({ unidade: unit.slug, data, descricao: descricao.trim() || null });
      // 23505 = essa data já está cadastrada na unidade; tratar como sucesso.
      if (error && (error as { code?: string }).code !== "23505") throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feriados", unit.slug] }),
  });
}

export function useDeleteFeriado() {
  const unit = useUnit();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("painel_feriados").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feriados", unit.slug] }),
  });
}

// Opções prontas para os modais de criar/editar.
//
// FALHA-ABERTO de propósito: se a consulta dos feriados falhar (rede, RLS), o
// mapa vem vazio e só o almoço bloqueia. Travar a agenda inteira porque uma
// tabela não respondeu pararia a recepção; deixar passar um feriado é
// recuperável. `feriadosIndisponiveis` deixa a tela avisar em vez de mentir.
export function useBloqueios(): OpcoesBloqueio & { feriadosIndisponiveis: boolean } {
  const cfg = useUnit().config;
  const { data, isError } = useFeriados();

  const feriadosExtras = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of data ?? []) {
      const [y, mo, d] = String(f.data).slice(0, 10).split("-");
      if (y && mo && d) m.set(`${d}/${mo}/${y}`, f.descricao?.trim() || "Feriado");
    }
    return m;
  }, [data]);

  // memoizado para o objeto ser estável entre renders: os modais usam ele como
  // dependência de useMemo/useCallback, e um literal novo a cada render faria
  // a lista de datas da recorrência recalcular à toa.
  return useMemo(
    () => ({
      almoco: cfg?.almoco,
      // sem config.feriados a unidade não tem bloqueio por data nenhum
      feriadosExtras: cfg?.feriados ? feriadosExtras : undefined,
      feriadosIndisponiveis: !!cfg?.feriados && isError,
    }),
    [cfg?.almoco, cfg?.feriados, feriadosExtras, isError],
  );
}
