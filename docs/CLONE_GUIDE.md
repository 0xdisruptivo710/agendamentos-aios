# Guia de Clonagem — Aios Clinics CRM

> **PRD operacional** para implantar o sistema em uma nova unidade.
> Tempo estimado: **20–40 minutos** por clínica (sem migração de dados legados).

---

## 1. Visão geral

### Arquitetura

Cada unidade de clínica recebe uma **instância independente**:

```
        ┌───────── GitHub (1 repo por unidade ou monorepo + branches) ─────────┐
        │                                                                      │
        ▼                                                                      ▼
   Vercel deploy A                                                  Vercel deploy B
        │                                                                      │
        ▼                                                                      ▼
 Supabase projeto A                                              Supabase projeto B
 (Dr Colágeno - Piracicaba)                                       (Clínica X - Cidade Y)
        │                                                                      │
        └───── tabelas aiosclinics_*  ◄──── mesmo schema ────►   tabelas aiosclinics_*
```

**Por que vale a pena:**

- Isolamento total de dados (cada clínica vê só os próprios pacientes).
- Cobrança Supabase/Vercel por unidade — escala linear, fácil de repassar.
- Schema **universal** (`aiosclinics_*`) → o código é igual em todas as clínicas; só mudam credenciais.

### O que muda por clínica

| Item | Onde fica | Muda por clínica? |
|---|---|---|
| URL e publishable key do Supabase | `src/integrations/supabase/client.ts` | ✅ Sim |
| Nome da clínica exibido no header | `src/components/calendar/CalendarHeader.tsx` | ✅ Sim |
| Nomes de tabela | hooks em `src/hooks/*` | ❌ Não (sempre `aiosclinics_*`) |
| Layout / fluxo / tema visual | resto do app | ❌ Não |

---

## 2. Pré-requisitos

Antes de começar uma nova clínica, garanta:

- [ ] Conta GitHub (preferencialmente a mesma org `0xdisruptivo710` ou outra org da Aios).
- [ ] Conta Vercel conectada ao GitHub.
- [ ] Conta Supabase (plano free serve para começar, ~500MB/projeto).
- [ ] Acesso ao MCP do Supabase (claude.ai) ou Supabase SQL Editor manual.
- [ ] Nome da clínica + cidade definidos.

---

## 3. Passo a passo — nova unidade

### 3.1 Criar o repositório

**Opção A — Fork (preferido para clínicas independentes):**

1. Vá em https://github.com/0xdisruptivo710/appointment-flow-friend
2. Clique em **Fork** → crie em `aios-clinics-<slug-cidade>` (ex: `aios-clinics-sorocaba`).

**Opção B — Branch num monorepo (preferido se quiser deploy automático em PRs):**

```bash
git clone https://github.com/0xdisruptivo710/appointment-flow-friend.git
cd appointment-flow-friend
git checkout -b clinic/sorocaba
```

### 3.2 Criar o projeto Supabase

1. https://supabase.com/dashboard → **New Project**.
2. Nome: `aiosclinics-<slug>` (ex: `aiosclinics-sorocaba`).
3. Região: **South America (São Paulo)** — menor latência para clínicas no Brasil.
4. Plano: Free → upgrade quando estourar limites.
5. Anote a **Project URL** e a **publishable key** (Settings → API).

### 3.3 Rodar o schema

Use o arquivo [`docs/sql/schema.sql`](sql/schema.sql) deste repo. Ele é **idempotente** e cria tudo de uma vez: 6 tabelas + RLS + bucket de storage + seed de procedimentos.

**Via MCP Supabase:**

```
mcp__claude_ai_Supabase__apply_migration(
  project_id: "<novo_project_ref>",
  name: "initial_schema",
  query: <conteúdo de docs/sql/schema.sql>
)
```

**Via SQL Editor manual:**

1. Supabase Dashboard → SQL Editor → New query.
2. Cole `docs/sql/schema.sql` inteiro.
3. Run.
4. Aguarde "Success. No rows returned." (a parte do seed pode demorar 1–2s).

**Validação:**

```sql
select count(*) as tables   from information_schema.tables
  where table_schema='public' and table_name like 'aiosclinics_%';      -- 6
select count(*) as buckets  from storage.buckets
  where id='aiosclinics-acompanhamento-fotos';                          -- 1
select count(*) as procs    from public.aiosclinics_procedimentos;      -- 50
```

### 3.4 Configurar o código

Atualize **3 arquivos** com os novos valores:

#### a) `src/integrations/supabase/client.ts`

```ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://<NOVO_PROJECT_REF>.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "<NOVA_PUBLISHABLE_KEY>";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { storage: localStorage, persistSession: true, autoRefreshToken: true }
});
```

#### b) `src/components/calendar/CalendarHeader.tsx`

Linha ~24:

```tsx
<span className="hidden sm:inline text-sm font-medium text-muted-foreground">
  Clínica X — Sorocaba
</span>
```

#### c) Hooks (se vier de um repo legacy com sufixo `_DrColageno_Piracicaba`)

O padrão **novo e universal** é `aiosclinics_*`. Se você está clonando do repo legacy, faça find/replace global:

| De (legacy) | Para (universal) |
|---|---|
| `Agendamento_DrColageno_Piracicaba` | `aiosclinics_agendamento` |
| `Anamnese_DrColageno_Piracicaba` | `aiosclinics_anamnese` |
| `Acompanhamento_DrColageno_Piracicaba` | `aiosclinics_acompanhamento` |
| `Acompanhamento_Fotos_DrColageno_Piracicaba` | `aiosclinics_acompanhamento_fotos` |
| `Responsaveis_DrColageno_Piracicaba` | `aiosclinics_responsaveis` |
| `Procedimentos_DrColageno_Piracicaba` | `aiosclinics_procedimentos` |
| bucket `acompanhamento-fotos` | `aiosclinics-acompanhamento-fotos` |

Arquivos afetados:

- `src/hooks/useAgendamentos.ts`
- `src/hooks/useAnamneses.ts`
- `src/hooks/useAcompanhamentos.ts`
- `src/hooks/useResponsaveis.ts`
- `src/hooks/useProcedimentos.ts`

> ⚠️ A migração do código existente do Dr Colágeno para o padrão universal `aiosclinics_*` ainda está pendente. Veja seção **6. Roadmap**.

### 3.5 Deploy na Vercel

1. https://vercel.com/new → Import o fork/repo.
2. Framework detectado: **Vite** (zero config).
3. Build command: `npm run build` (default).
4. Output: `dist` (default).
5. Deploy.

Cada push para `main` vira produção; cada PR vira preview com URL própria.

### 3.6 Validação pós-deploy

- [ ] Abra a URL de produção.
- [ ] Aba Agenda carrega (vazia se Supabase novo).
- [ ] Cadastre um responsável em "Responsáveis" e veja aparecer.
- [ ] Confirme no Supabase (Table Editor) que apareceu em `aiosclinics_responsaveis`.
- [ ] Cadastre uma anamnese de teste.
- [ ] Confira que o nome da clínica aparece no header.

---

## 4. Convenções de naming

### Por que `aiosclinics_*` (lowercase, snake_case)?

- ❌ `Agendamento_DrColageno_Piracicaba` (legacy): nomes mixed-case e com caracteres especiais quebram com Postgres sem aspas duplas — toda query precisa `from('"Tabela_Como_Esta"')`. Frágil.
- ✅ `aiosclinics_agendamento`: snake_case puro, não precisa aspas, é o padrão Postgres/Supabase.
- ✅ O prefixo `aiosclinics_` evita colisão com tabelas internas do Supabase (`auth.users`, `storage.objects`, etc.) e identifica o produto.

### Por que não usar variáveis de ambiente para o nome das tabelas?

Considerei. Foi descartado porque:

- A complexidade extra (build-time string interpolation, type safety) não compensa.
- Cada clínica tem **seu próprio Supabase**. Não faz sentido o mesmo deploy apontar para schemas diferentes.
- O ganho real é zero — você muda credenciais, não nomes de tabela.

---

## 5. FAQ operacional

**Q: Posso usar a mesma Supabase para várias clínicas (multi-tenant)?**
A: Tecnicamente sim, com coluna `clinic_id` e RLS por tenant. Mas perde-se isolamento de billing e LGPD vira mais complexo. **Recomendação: um Supabase por clínica.**

**Q: Como faço backup?**
A: Supabase Dashboard → Database → Backups (diário automático no Free; PITR no Pro). Para export pontual: `pg_dump` via `connection string` direto.

**Q: Como adiciono novos procedimentos sem rodar SQL?**
A: Hoje não tem UI. Você roda `INSERT INTO aiosclinics_procedimentos (nome, categoria) VALUES (...)` direto no SQL Editor. UI de gerenciamento é uma feature futura (ver Roadmap).

**Q: O sistema tem login?**
A: ❌ Não. Hoje o acesso é aberto (qualquer um com a URL acessa). Para produção real você **deve** adicionar auth — ver Roadmap. Por enquanto, mantenha a URL privada.

**Q: Como faço upgrade do schema depois (adicionar coluna)?**
A: Crie um arquivo `docs/sql/migrations/YYYY-MM-DD_descricao.sql`, escreva `alter table ...`, rode via MCP `apply_migration` em **todas** as clínicas ativas.

---

## 6. Roadmap recomendado

Em ordem de prioridade:

### 🔴 P0 — Adoção do schema universal (urgente para escalar)

- [ ] Refatorar hooks do Dr Colágeno para usar `aiosclinics_*`.
- [ ] Script de migração: copiar dados de `<Entity>_DrColageno_Piracicaba` → `aiosclinics_<entity>` no Supabase atual.
- [ ] Atualizar `useAcompanhamentos.ts` para usar bucket `aiosclinics-acompanhamento-fotos`.

### 🟡 P1 — Configuração externa

- [ ] Mover `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `CLINIC_NAME` para `.env` (`VITE_*`) e ler em runtime.
- [ ] `.env.example` com placeholders.
- [ ] Documentar setup de env vars na Vercel (Settings → Environment Variables).

Benefício: clone de nova clínica não precisa mais alterar código — só env vars. Fluxo vira:
1. Fork repo (zero edits)
2. Cria Supabase + roda schema.sql
3. Configura env vars na Vercel
4. Deploy

### 🟢 P2 — Auth e segurança

- [ ] Adicionar Supabase Auth (email/password ou magic link).
- [ ] Apertar RLS: `using (auth.uid() is not null)` em todas as tabelas.
- [ ] Tabela `aiosclinics_usuarios` com `clinic_id` e `role` (admin / atendente / auditor).

### 🔵 P3 — UI para gestão

- [ ] Tela de gerenciar procedimentos (adicionar/desativar via interface).
- [ ] Tela de configurações da clínica (nome, logo, cores) sem precisar editar código.

---

## 7. Referências

- Schema SQL: [`docs/sql/schema.sql`](sql/schema.sql)
- Tema visual / design system Aios CRM: na raiz `aios_crm_design_system.html` (cores, tipografia, tokens).
- Histórico de schemas legados: `docs/sql/aiosclinics_schema.sql`, `add_paciente_telefone.sql`, etc.
