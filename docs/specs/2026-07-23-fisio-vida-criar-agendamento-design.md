# Fisio Vida — criar agendamento (+ recorrência) no painel e cor dos cards

**Data:** 2026-07-23
**Escopo:** unidade `fisio-vida` do Painel de Agendamento AIOS.
**Tabela:** `Agendamento_Fisio_Vida` (Supabase `ehlpmukjdknnyhkycncb`).

## Contexto

Hoje o painel só lê/edita agendamentos existentes (criados pelo webhook `fisiovida_agendamento`,
que recebe `CONTACT_UPDATE` do WTS e insere na tabela). A mesma tabela alimenta o painel **e** os
lembretes (crons 8h "No dia" e 16h "1 Dia antes" no n8n `KTpJjugDH4ixkNGh`, que fazem `getAll` na
tabela e disparam por linha). Pedido do cliente:

1. Botão **"Novo agendamento"** no painel.
2. **Recorrência**: escolher quantas vezes e quais dias → 1 lembrete por sessão.
3. Depois de criar, os dados vão para o banco para os lembretes serem agendados.
4. Trocar a cor dos cards da agenda de **cinza para roxo**.

## Decisões (aprovadas)

- **Gravação direta no Supabase** (não via webhook). Os lembretes já leem a tabela, então inserir a
  linha basta. Evita a ambiguidade de data do webhook (ele tenta MM/dd antes de dd/MM).
- **Recorrência** = dias da semana + nº de sessões + data de início + horário fixo → gera N linhas.
- **Cor**: pendente/sem-status vira **roxo da marca** (primary). Confirmado/compareceu continua verde,
  falta continua vermelho/âmbar.

## Permissão (migração `fisio_vida_anon_insert_policy`)

A tabela tinha policies anon de SELECT/UPDATE, mas **não INSERT** → o painel (anon key) não criava linha.
Adicionada `GRANT INSERT` + policy `aios_panel_anon_insert` (WITH CHECK true, anon+authenticated),
**só na tabela da Fisio Vida**. Mesma postura das demais (anon aberto, URL é o segredo). O índice único
parcial `uniq_fisiovida_telefone_data (Telefone, Data)` barra duplicar o mesmo horário. Verificado com
POST via anon key (HTTP 201) + delete do canário.

## Arquitetura

- **`src/config/units.ts`** — `UnitConfig` ganha `criar?`, `nameCol?`, `phoneCol?`. Fisio Vida:
  `criar: true, nameCol: "Noem", phoneCol: "Telefone"` (colunas físicas divergentes da tabela).
- **`src/lib/agendamento-create.ts`** (novo) — `normalizePhoneBR` (→ 55+DDD+número),
  `generateOccurrences` (dias da semana × nº sessões → datas "dd/MM/yyyy HH:mm", horário fixo),
  `singleOccurrence`, e a lista `WEEKDAYS`. Testado em `agendamento-create.test.ts`.
- **`useCreateAgendamentos()`** (hook) — insere 1 linha por sessão via colunas físicas da unidade;
  tolerante a duplicata (código 23505 = pulado, não quebra o lote); invalida o cache ao terminar.
- **`CreateAppointmentDialog.tsx`** (novo) — Nome + Telefone (obrigatórios); toggle recorrente
  (não: data+hora / sim: dias da semana + início + horário + nº sessões) com **preview das datas**;
  opcionais Categoria/Origem/Procedimento/Responsável. Botão "Criar N sessões".
- **`CalendarHeader.tsx`** — botão roxo "Novo agendamento" (só quando `config.criar`).
- **`UnitPanel.tsx`** — estado + render do `CreateAppointmentDialog`, reaproveita as `suggestions`.
- **Cor dos cards** — o tom `muted` (pendente) passou de cinza para roxo (`primary`) em
  `agendamento-status.ts` (TONE_BORDER/TONE_CHIP), Day/Week/MonthView e no selo do modal de detalhes.

## Como vira lembrete

Criar = inserir linha(s) com `Noem` + `Telefone` (13 díg) + `Data` ("dd/MM/yyyy HH:mm"). O cron
8h/16h faz `getAll` na tabela, filtra Data==hoje/amanhã + flags vazias + Telefone preenchido e dispara.
Nada mais precisa ser configurado. Não escreve de volta no custom field do WTS (os lembretes não usam).

## Fora de escopo (YAGNI)

Editar/cancelar a recorrência inteira de uma vez (cada sessão é uma linha independente); sincronizar de
volta o custom field no WTS.

## Verificação

- `tsc --noEmit` limpo · `vitest` 18/18 (novos testes de telefone e recorrência) · `vite build` ok.
- INSERT anônimo na tabela real (canário telefone fake + data 2099, HTTP 201, deletado).
- Dogfood `/browse`: botão abre o modal; preview de 8 sessões (Seg+Qua) correto; cards da agenda em roxo.
