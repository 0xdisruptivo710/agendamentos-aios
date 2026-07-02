# Design — Painel de Agendamento multi-tenant (AIOS)

> Data: 2026-07-02 · Status: implementado (v1) · Repo: `agendamentos-aios`

## Contexto

Cada unidade AIOS tem uma tabela de agendamento espelhada (alimentada por
automações n8n) no **mesmo** projeto Supabase compartilhado
(`ehlpmukjdknnyhkycncb`). O app de referência `agendamentodourados` (Vite +
React + shadcn + Supabase) atendia **uma** unidade com o nome da tabela e da
clínica hardcoded. O objetivo é servir ~27 unidades a partir de um único app,
padronizando ("deixar redondo") os dados espelhados sem quebrar as automações.

## Decisões (aprovadas)

1. **Deploy:** um único app multi-tenant, rota `/[unidade]`. Todas as unidades
   compartilham o mesmo Supabase e a mesma anon key, então deploys separados
   não trazem isolamento — um registry de 1 linha por unidade é suficiente.
2. **Padronização de dados:** adapter no app (coalesce das variações de coluna)
   **+ migração aditiva** no Postgres (`ADD COLUMN IF NOT EXISTS`) — nunca
   renomeia/altera/dropa coluna existente, para não quebrar as automações.
3. **Veículos fora do v1:** Allus, Malentachi e TS (revendas) excluídos — schema
   e semântica diferentes (Test Drive/Compareceu). Ganham painel próprio depois.
4. **Abas v1:** Agenda + Relatórios (alimentadas pela tabela de agendamento). As
   abas clínicas (Anamnese/Acompanhamento/Responsáveis) exigiam tabelas
   `aiosclinics_*`/`facedoctordourados_*` que as unidades não têm — removidas do v1.

## Arquitetura

- `src/config/units.ts` — registry (fonte única da verdade). Cada `Unit`:
  `{ slug, label, table, respStyle }`. Adicionar unidade = 1 entrada.
- `src/context/UnitContext.tsx` — `UnitProvider` + `useUnit()`.
- Rotas (`src/App.tsx`): `/` → `Landing` (lista de unidades); `/:slug` →
  resolve no registry → `UnitProvider` → `UnitPanel`; slug inválido → `NotFound`.
- `useAgendamentos()` lê `unit.table` do contexto; `queryKey` inclui a tabela.

### Camada de dados

Leitura (`fromRow`) normaliza as variações reais das ~27 tabelas para um shape
canônico único:

- **Responsável** (3 grafias): `Responsavel_Agendamento` (ASCII) ·
  `"Responsável Agendamento"` (acento+espaço) · `"Responsavel Agendamento"`.
- **Cancelamento:** `Cancelamento` ?? `Cancelado`.
- `Valor`/`Tipo`/`Procedimento`: lidos se existirem, senão `null`.

Escrita (`toRow`) mira a coluna que a tabela **realmente** tem, via
`unit.respStyle` (`accented` | `ascii`) — não cria coluna duplicada nem escreve
numa grafia que a automação não usa.

### Migração aditiva (aplicada em 2026-07-02)

`painel_agendamento_standardize_additive` — bloco `DO` idempotente sobre as 27
tabelas:

- `ADD COLUMN IF NOT EXISTS` para `Procedimento`, `Valor`, `Tipo`.
- Par ASCII `Responsavel_Agendamento`/`_Atendimento` **somente** onde nenhuma
  grafia existia (6 tabelas).
- `Cancelamento` somente onde não havia nem `Cancelamento` nem `Cancelado`.
- Políticas nomeadas `aios_panel_anon_select` / `aios_panel_anon_update` (anon +
  authenticated) em todas as 27 — idempotentes, sem tocar em políticas existentes.

> **Postura de segurança (v1, herdada do produto):** acesso anônimo aberto via
> anon key; a URL é o segredo. Sem auth. A migração ampliou o UPDATE anônimo para
> as 18 tabelas que ainda não tinham, mantendo paridade com as 9 já abertas.
> Reversível (drop das 2 políticas nomeadas). Auth/RLS por unidade é roadmap.

## Escopo (tabela viva por unidade, resolvida por liveness)

Duplicatas resolvidas pela última escrita: Barra → `barradatijucaclinics_agendamento`;
Itupeva → `itupevaclinics_agendamento`; Macaé → `Agendamento_Macae` (legado é o
vivo); Dr Colágeno → `Agendamento_DrColageno_Piracicaba`. Descartados: duplicatas
mortas, `Agendamento_Campolim.` (lixo), backup `_bkp_franquia95`,
`aiosclinics_agendamento` (scaffold vazio), Goiânia (fora do escopo), veículos.

27 unidades no registry. Várias estão com 0 linhas (unidade onboarded, automação
ainda sem output) — renderizam agenda vazia e populam sozinhas.

## Deploy

Vite (zero-config na Vercel). Um projeto Vercel serve todas as unidades
(`/macae`, `/itupeva`, …). `vercel.json` já reescreve tudo para `index.html`
(SPA). Domínio/subdomínio por cliente = upgrade futuro.

## Roadmap

- Auth (Supabase) + RLS por unidade; apertar as políticas anon.
- Abas clínicas por unidade (feature flag no registry) quando houver tabelas.
- Variante `veiculos` para Allus/Malentachi/TS (funil de test drive).
- Domínio/subdomínio por cliente.
