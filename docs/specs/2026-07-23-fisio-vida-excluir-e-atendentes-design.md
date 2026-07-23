# Fisio Vida — excluir agendamento e cadastro de atendentes

**Data:** 2026-07-23
**Escopo:** unidade `fisio-vida` do Painel de Agendamento AIOS.

## Pedidos

1. Botão de **excluir agendamento** — ao clicar, apaga do banco também.
2. Botão de **cadastrar atendente** — os relatórios pedem "cadastre mais responsáveis" mas não havia
   onde cadastrar.

## Decisões

- **Excluir**: botão no modal de detalhes, com confirmação inline, DELETE direto no Supabase.
- **Atendentes**: não existiam como entidade (eram texto livre em `Responsavel_Atendimento`). Criado um
  **cadastro** (tabela `painel_atendentes` por unidade) que alimenta o dropdown "Resp. atendimento" ao
  criar/editar. Fluxo: cadastra → vira opção no dropdown → atribui nos agendamentos → aparece no relatório.

## Banco (migrações)

- `fisio_vida_anon_delete_policy` — `GRANT DELETE` + policy `aios_panel_anon_delete` (anon+authenticated,
  USING true) **só na `Agendamento_Fisio_Vida`**. Verificado por DELETE anon HTTP 204.
- `painel_atendentes_table` — tabela `public.painel_atendentes (id, created_at, unidade, nome)` com índice
  único `(unidade, lower(nome))`, RLS on e policies anon SELECT/INSERT/DELETE (mesma postura do painel).
  Verificado por INSERT (201) / SELECT / DELETE (204) anon.

## Código

- **`units.ts`** — `UnitConfig` ganha `excluir?` e `atendentes?`. Fisio Vida: ambos `true`.
- **`useAgendamentos.ts`** — `useDeleteAgendamento(id)` (DELETE por id, invalida cache).
- **`useAtendentes.ts`** (novo) — `useAtendentes` (lista por `unidade = slug`), `useCreateAtendente`
  (trata 23505 como sucesso), `useDeleteAtendente`.
- **`EventDetailDialog.tsx`** — botão "Excluir agendamento" (só `config.excluir`) com confirmação inline
  ("Não dá pra desfazer" → Cancelar / Excluir). Reseta ao abrir o modal.
- **`AtendentesDialog.tsx`** (novo) — lista + adicionar + remover atendentes.
- **`ReportsView.tsx`** — botão "Cadastrar atendente" (só `config.atendentes`) que abre o dialog; a dica
  do gráfico "Atendimentos por responsável" passou a apontar o fluxo.
- **`UnitPanel.tsx`** — `useAtendentes()` mescla os nomes cadastrados nas `suggestions` de responsável,
  então aparecem no dropdown mesmo sem nenhum agendamento ainda.

## Verificação

- `tsc --noEmit` limpo · `vitest` 18/18 · `vite build` ok.
- Canários anon na tabela real: DELETE agendamento 204; atendente INSERT 201 / SELECT / DELETE 204 (limpos).
- Dogfood `/browse`: botão "Excluir agendamento" presente no modal; "Cadastrar atendente" na aba
  Relatórios abre o dialog; cadastro de atendente ponta-a-ponta (aparece na lista). Sem erros de console.

## Fora de escopo

Excluir/editar uma recorrência inteira de uma vez (cada sessão é uma linha; excluir apaga uma).
