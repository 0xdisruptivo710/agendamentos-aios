import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnit } from "@/context/UnitContext";
import { mesclarCores } from "@/lib/profissional-cores";
import type { UnitConfig } from "@/config/units";

// Cadastro de atendentes por unidade (tabela painel_atendentes). Alimenta o
// dropdown de "Resp. atendimento" nos modais de criar/editar agendamento.
// `cor` (opcional, definida pela UI) marca os atendimentos do profissional
// na agenda — junta com as cores fixas de config.cores.
export interface Atendente {
  id: number;
  nome: string;
  cor: string | null;
}

export function useAtendentes() {
  const unit = useUnit();
  return useQuery({
    queryKey: ["atendentes", unit.slug],
    queryFn: async (): Promise<Atendente[]> => {
      const { data, error } = await supabase
        .from("painel_atendentes")
        .select("id, nome, cor")
        .eq("unidade", unit.slug)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Atendente[];
    },
  });
}

// Cores por profissional efetivas da unidade: config.cores (fixas) + cores
// definidas no cadastro de atendentes (estas têm precedência). Mesma forma
// que config.cores, então corDoProfissional/legendaCores funcionam sem mudança.
export function useCoresProfissionais(): UnitConfig["cores"] {
  const unit = useUnit();
  const { data: atendentes } = useAtendentes();
  return useMemo(
    () => mesclarCores(unit.config?.cores, atendentes),
    [unit.config?.cores, atendentes],
  );
}

// Define/limpa a cor de um atendente (coluna painel_atendentes.cor).
export function useSetCorAtendente() {
  const unit = useUnit();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, cor }: { id: number; cor: string | null }) => {
      const { error } = await supabase.from("painel_atendentes").update({ cor }).eq("id", id);
      if (error) throw error;
      return { id, cor };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendentes", unit.slug] }),
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
