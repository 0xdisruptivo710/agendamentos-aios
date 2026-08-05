# Fisio Vida — Excluir futuros do paciente + Filtro por fisioterapeuta

**Data:** 2026-08-05 · **Unidade:** fisio-vida (config-gated; zero impacto nas demais)

## Contexto

Dois pedidos do cliente para o Painel de Agendamento:

1. **Exclusão em massa**: quando o paciente encerra o tratamento, a recepção precisa
   apagar de uma vez todos os agendamentos futuros dele (hoje é um por um).
2. **Filtro por fisioterapeuta**: ver a agenda de um profissional só (a legenda de
   cores já existe, mas não filtra).

## Decisões (com o usuário)

- Exclusão em massa mora no **modal de detalhes** (abrir qualquer agendamento do
  paciente), ao lado do excluir unitário existente.
- "Futuro" = `Data > agora`, **incluindo a sessão aberta** se ela for futura.
- Filtro = **dropdown + legenda clicável**, seleção única, match por **prefixo
  normalizado** (dropdown manda nome completo, legenda manda primeiro nome).
- Filtro vale **só para a aba Agenda** (3 calendários + Próximos). Stats do topo e
  Relatórios seguem completos.

## Feature 1 — Excluir todos os futuros do paciente (`config.excluirFuturos`)

- `sessoesFuturasDoPaciente(event, agendamentos, now)` em `agendamento-reagendar.ts`:
  reusa `samePatient` (telefone com fallback de nome normalizado) + `parsedDate > now`.
  Diferente de `findFutureSiblings`, NÃO restringe a dia da semana/horário.
- `useDeleteAgendamentos(ids)` em `useAgendamentos.ts`: um único
  `DELETE ... IN (ids)`. IDs calculados no cliente porque `Data` é texto
  `dd/MM/yyyy HH:mm` — comparação de "futuro" no servidor não é confiável.
- Modal: botão "Excluir todos os futuros deste paciente (N)" abaixo do excluir
  unitário, com confirmação inline no mesmo padrão. N=0 → botão oculto.
- Espelho Infosoft (unidades com `webhookInfosoft`): dispara
  `agendamento_excluido` POR SESSÃO excluída (o n8n acha cada autorização por
  Número + Data). Na Fisio Vida é no-op (sem webhook configurado).
- **Zero migração**: policy anon de DELETE já existe (`aios_panel_anon_delete`,
  23/07). Crons de lembrete e agente leem a tabela ao vivo — linha apagada some
  dos lembretes automaticamente.

## Feature 2 — Filtro por fisioterapeuta (`config.filtroProfissional`)

- Estado local no `UnitPanel` (`fisio`, "" = todos), composto com a busca em E
  lógico dentro de `agendamentosVisiveis`.
- `matchProfissional(respAtendimento, filtro)` em `profissional-cores.ts`:
  prefixo normalizado (sem acento/caixa); filtro vazio deixa tudo passar.
- Dropdown (shadcn Select) ao lado da busca com "Todos os profissionais" +
  `suggestions.respAtendimento` (distintos da base + atendentes cadastrados —
  inclui quem não tem cor, ex. Rafael Borba). Sentinela `__todos__` (Radix não
  aceita item com value vazio).
- Legenda clicável (só com `filtroProfissional` ligado): clicar no chip aplica
  `fisio = primeiroNome` (toggle); chip ativo ganha destaque. Chip fica ativo
  também quando o nome completo selecionado no dropdown começa com o prefixo dele.
- Contador "N agendamentos encontrados" aparece quando busca e/ou filtro ativos.

## Config (units.ts)

`UnitConfig` ganha `excluirFuturos?: boolean` e `filtroProfissional?: boolean`;
fisio-vida liga os dois. Nenhuma outra unidade muda.

## Testes e verificação

- vitest: `sessoesFuturasDoPaciente` (telefone, fallback de nome, exclui passadas,
  inclui a sessão aberta futura, ignora outro paciente) e `matchProfissional`.
- tsc + build; canário anon na tabela real (INSERT de linhas fake → DELETE em
  massa via `.in()` → conferência); dogfood no browser.

## Fora de escopo

- Multi-seleção de profissionais; filtro nos Relatórios; desfazer exclusão.
