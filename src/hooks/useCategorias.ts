import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnit } from "@/context/UnitContext";

// Categorias extras por unidade (tabela painel_categorias) — só unidades com
// config.addCategorias. Elas somam às categorias fixas do config nos Selects
// de "Categoria" dos modais de criar/editar agendamento.
export interface Categoria {
  id: number;
  nome: string;
}

export function useCategorias() {
  const unit = useUnit();
  return useQuery({
    queryKey: ["categorias", unit.slug],
    enabled: !!unit.config?.addCategorias,
    queryFn: async (): Promise<Categoria[]> => {
      const { data, error } = await supabase
        .from("painel_categorias")
        .select("id, nome")
        .eq("unidade", unit.slug)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Categoria[];
    },
  });
}

export function useCreateCategoria() {
  const unit = useUnit();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string) => {
      const clean = nome.trim();
      if (!clean) throw new Error("Nome vazio");
      const { error } = await supabase.from("painel_categorias").insert({ unidade: unit.slug, nome: clean });
      // 23505 = já existe essa categoria na unidade — trata como sucesso silencioso.
      if (error && (error as { code?: string }).code !== "23505") throw error;
      return clean;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categorias", unit.slug] }),
  });
}

export function useDeleteCategoria() {
  const unit = useUnit();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("painel_categorias").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categorias", unit.slug] }),
  });
}

// Lista final de categorias da unidade: fixas do config + extras cadastradas,
// sem duplicar (comparação sem caixa).
export function mergeCategorias(fixas: string[], extras: Categoria[] | undefined): string[] {
  const out = [...fixas];
  const seen = new Set(fixas.map((c) => c.trim().toLowerCase()));
  for (const c of extras ?? []) {
    const key = c.nome.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c.nome);
    }
  }
  return out;
}
