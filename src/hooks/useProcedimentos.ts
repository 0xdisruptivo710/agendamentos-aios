import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnit } from "@/context/UnitContext";

// Procedimentos/planos por unidade (tabela painel_procedimentos) — só unidades
// com config.addProcedimentos. Entram como sugestão no campo "Procedimento" dos
// modais de criar/editar, somando aos valores já usados na agenda. Semeada com
// o catálogo das exportações da agenda digital (RelatorioAulas) na Fisio Vida.
export interface Procedimento {
  id: number;
  nome: string;
}

export function useProcedimentos() {
  const unit = useUnit();
  return useQuery({
    queryKey: ["procedimentos", unit.slug],
    enabled: !!unit.config?.addProcedimentos,
    queryFn: async (): Promise<Procedimento[]> => {
      const { data, error } = await supabase
        .from("painel_procedimentos")
        .select("id, nome")
        .eq("unidade", unit.slug)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Procedimento[];
    },
  });
}

export function useCreateProcedimento() {
  const unit = useUnit();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string) => {
      const clean = nome.trim();
      if (!clean) throw new Error("Nome vazio");
      const { error } = await supabase.from("painel_procedimentos").insert({ unidade: unit.slug, nome: clean });
      // 23505 = já existe esse procedimento na unidade — sucesso silencioso.
      if (error && (error as { code?: string }).code !== "23505") throw error;
      return clean;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["procedimentos", unit.slug] }),
  });
}

export function useDeleteProcedimento() {
  const unit = useUnit();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("painel_procedimentos").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["procedimentos", unit.slug] }),
  });
}
