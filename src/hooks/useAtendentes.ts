import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnit } from "@/context/UnitContext";

// Cadastro de atendentes por unidade (tabela painel_atendentes). Alimenta o
// dropdown de "Resp. atendimento" nos modais de criar/editar agendamento.
export interface Atendente {
  id: number;
  nome: string;
}

export function useAtendentes() {
  const unit = useUnit();
  return useQuery({
    queryKey: ["atendentes", unit.slug],
    queryFn: async (): Promise<Atendente[]> => {
      const { data, error } = await supabase
        .from("painel_atendentes")
        .select("id, nome")
        .eq("unidade", unit.slug)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Atendente[];
    },
  });
}

export function useCreateAtendente() {
  const unit = useUnit();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string) => {
      const clean = nome.trim();
      if (!clean) throw new Error("Nome vazio");
      const { error } = await supabase.from("painel_atendentes").insert({ unidade: unit.slug, nome: clean });
      // 23505 = já existe esse nome na unidade — trata como sucesso silencioso.
      if (error && (error as { code?: string }).code !== "23505") throw error;
      return clean;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendentes", unit.slug] }),
  });
}

export function useDeleteAtendente() {
  const unit = useUnit();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("painel_atendentes").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendentes", unit.slug] }),
  });
}
