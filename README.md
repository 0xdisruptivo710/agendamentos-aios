# agendamentos-aios

Painel de Agendamento **multi-tenant** das unidades AIOS. Um único app Vite +
React serve ~27 unidades a partir do Supabase compartilhado
(`ehlpmukjdknnyhkycncb`), diferenciando por rota `/[unidade]`.

- `/` → lista de unidades (landing).
- `/:slug` → agenda + relatórios daquela unidade.

## Como funciona

Cada unidade é uma entrada em [`src/config/units.ts`](src/config/units.ts):

```ts
{ slug: "macae", label: "Face Doctor Macaé", table: "Agendamento_Macae", respStyle: "accented" }
```

- `table` — a tabela **viva** de agendamento no Supabase.
- `respStyle` — grafia das colunas de responsável na tabela (`accented` ou
  `ascii`), usada só na escrita. A leitura (`src/hooks/useAgendamentos.ts`) faz
  *coalesce* de todas as grafias, então a UI é idêntica para todas as unidades.

**Adicionar uma unidade nova:** adicione 1 entrada em `units.ts` apontando para a
tabela. Nada mais muda.

## Rodar local

```bash
npm install
npm run dev       # http://localhost:5173  → abra /macae, /itupeva, etc.
npm run build     # build de produção em dist/
npx tsc --noEmit -p tsconfig.app.json   # typecheck
```

O Supabase (URL + anon key) fica em
[`src/integrations/supabase/client.ts`](src/integrations/supabase/client.ts).

## Padronização dos dados

As tabelas têm schemas ligeiramente diferentes (herança histórica). A
padronização é **aditiva** e não-destrutiva: veja
[`docs/specs/2026-07-02-painel-agendamento-multitenant-design.md`](docs/specs/2026-07-02-painel-agendamento-multitenant-design.md).
As automações n8n que escrevem nas tabelas continuam intactas.

## Deploy (Vercel)

Framework Vite (zero-config). `vercel.json` já cobre o roteamento SPA.

```bash
vercel --prod
```

Um projeto serve todas as unidades: `https://<projeto>.vercel.app/macae`, etc.
