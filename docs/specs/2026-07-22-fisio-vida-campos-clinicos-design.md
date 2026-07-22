# Fisio Vida — campos clínicos no painel de agendamento

**Data:** 2026-07-22
**Escopo:** unidade `fisio-vida` do Painel de Agendamento AIOS (multi-tenant).
**Repo:** agendamentos-aios · **Tabela:** `Agendamento_Fisio_Vida` (Supabase `ehlpmukjdknnyhkycncb`).

## Contexto

A Fisio Vida (clínica de fisioterapia, Porto Alegre) pediu 3 mudanças no painel que mostra os
agendamentos da unidade:

1. Campos personalizados **"Paciente agendou?"** (Sim/Não) e **"Origem do paciente"** (Convênio/Particular).
2. **Registro de presença e falta** na agenda, com e sem justificativa.
3. **Personalizar as categorias de atendimento** para melhorar a leitura dos relatórios.

Leitura da base real (`GET` da tabela, 4.758 linhas) que orientou o desenho:
- **4.730 linhas com `Procedimento`** = planos de fisio com frequência (`Atividade Reflexa 2x/3x/1x/5x`,
  `RPG`, `Pilates`, `Reab. Perineal`, `Pat. Osteomuscular`, `Terapia Neural`, `Avaliação`,
  `Cons. Domiciliar`, `AFISVEC`). Muitos com prefixo de convênio (`C-`/`BC`/`AFISVEC`).
- **`Tipo` só em 23 linhas** com "Avaliação"/"Agendamento" (categorias de estética herdadas do código,
  inúteis para fisio). É o campo que alimenta o gráfico "Distribuição por tipo".
- **Sem colunas de presença/origem/confirmação** (`Cancelamento`/`Confirmado1..3` zerados).

## Decisões (aprovadas)

- **"Paciente agendou?"** = confirmação do horário (Sim/Não).
- **Escopo:** só Fisio Vida, via **config por unidade** no registry. As outras 27 unidades ficam idênticas.
- **Categorias:** lista detalhada de 8 (fisioterapia).

## Modelo de dados

Migração aditiva, idempotente, não-destrutiva, **só na tabela da Fisio Vida**
(`fisio_vida_campos_agendou_origem_presenca`). Não toca colunas da automação n8n
(`1 Dia antes`/`No dia`/`Cancelamento`). Policies anônimas da tabela (`SELECT`/`UPDATE` = true) já cobrem
as novas colunas (verificado com PATCH via anon key, HTTP 200).

| Campo (UI)          | Coluna (`text`)  | Valores |
|---------------------|------------------|---------|
| Paciente agendou?   | `Agendou`        | `Sim` / `Não` |
| Origem do paciente  | `Origem`         | `Convênio` / `Particular` |
| Comparecimento      | `Presenca`       | `Compareceu` / `Faltou (justificada)` / `Faltou (não justificada)` |
| Justificativa       | `Justificativa`  | texto livre (só em falta justificada) |
| Categoria           | `Tipo` (já existe) | 8 categorias de fisio |

```sql
ALTER TABLE "Agendamento_Fisio_Vida"
  ADD COLUMN IF NOT EXISTS "Agendou"       text,
  ADD COLUMN IF NOT EXISTS "Origem"        text,
  ADD COLUMN IF NOT EXISTS "Presenca"      text,
  ADD COLUMN IF NOT EXISTS "Justificativa" text;
```

## Arquitetura

- **`src/config/units.ts`** — `Unit` ganha `config?: UnitConfig { categorias?, agendou?, origem?, presenca? }`.
  Só a Fisio Vida declara. Quem não tem config segue o default (Select "Tipo" = Avaliação/Agendamento,
  sem campos clínicos).
- **`src/lib/agendamento-status.ts`** (novo) — fonte única do status. `deriveStatus()` aplica a cadeia de
  prioridade **Presença → Agendou → Confirmação legada → Pendente** e devolve `{ key, tone, label }`.
  Também: constantes (`AGENDOU`/`ORIGEM`/`PRESENCA`), mapas de classe por tom, e `guessOrigem()` (heurística
  não-destrutiva: prefixo de convênio → sugere "Convênio", só no formulário).
- **`src/hooks/useAgendamentos.ts`** — 4 campos no tipo `Agendamento`, no `fromRow` (leitura) e no `toRow`
  (escrita). Colunas ASCII de nome único (sem `respStyle`). O `toRow` só grava chaves presentes no update,
  e o modal só envia essas chaves quando a unidade habilita — nenhuma outra tabela recebe colunas que não tem.
- **`EventDetailDialog.tsx`** — blocos condicionais por config: Comparecimento (segmentado + Justificativa
  em falta justificada), Categoria (Select das 8), Paciente agendou? (Sim/Não), Origem (Select). Status do
  topo agora vem de `deriveStatus`.
- **`DayView`/`WeekView`/`MonthView`** — status por `deriveStatus` (presença/falta aparecem na agenda:
  compareceu = verde, faltou = vermelho/âmbar). DayView mostra também um chip de Origem.
- **`ReportsView.tsx`** — seção "Comparecimento e origem" (gated): KPIs (Taxa de comparecimento, Faltas
  com/sem justificativa, Taxa de confirmação) + gráficos Comparecimento e Origem (cores semânticas). A pizza
  "Distribuição por tipo" passa a mostrar as 8 categorias.

## Fora de escopo (YAGNI)

- Editar categorias pela UI.
- Backfill retroativo de `Tipo`/`Origem` nos 4.730 procedimentos legados (pode virar sessão separada,
  heurística por prefixo do procedimento).

## Verificação

- `tsc --noEmit` limpo · `vitest` 9/9 (novo teste de `deriveStatus`/`guessOrigem`) · `vite build` ok.
- Escrita anônima das 4 colunas na tabela real (linha canário, PATCH HTTP 200, revertida).
- Dogfood no `/browse` (localhost:8080/fisio-vida): modal e relatórios renderizam sem erro de console.
