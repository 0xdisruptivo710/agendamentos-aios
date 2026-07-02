# Plano: Anamnese e Acompanhamento

## Visão geral

Criar duas novas abas no app, cada uma com sua tabela dedicada no Supabase, vinculadas ao paciente via `agendamento_id` (FK para `Agendamento_DrColageno_Piracicaba.id`). Adicionar botões de atalho no card de detalhes do agendamento para cadastrar uma anamnese ou abrir o acompanhamento daquele paciente.

---

## 1. Aba "Anamnese"

**Função:** registrar a ficha de anamnese completa do paciente (histórico de saúde, alergias, medicamentos, queixa principal, etc.) e listar todas as anamneses já feitas.

**UI:**
- Nova aba `Anamnese` no `Tabs` em `src/pages/Index.tsx` (ícone `ClipboardList` ou `FileText`).
- Lista (cards) com todas anamneses cadastradas: nome do paciente, data, resumo da queixa, botão "Ver/Editar".
- Barra de pesquisa por nome do paciente.
- Botão "+ Nova anamnese" abrindo um dialog com formulário completo.
- No `EventDetailDialog` (card do agendamento), adicionar botão **"Cadastrar/Ver anamnese"** que abre o mesmo formulário já vinculado àquele paciente.

**Campos do formulário (sugestão padrão estética):**
- Queixa principal
- Histórico de saúde (doenças prévias)
- Alergias
- Medicamentos em uso
- Cirurgias prévias
- Gestante / amamentando (sim/não)
- Procedimentos estéticos anteriores
- Tabagismo / etilismo
- Tipo de pele
- Exposição solar
- Observações gerais
- Data da anamnese

---

## 2. Aba "Acompanhamento"

**Função:** acompanhar a evolução do tratamento por meio de fotos (antes/durante/depois) e definir data de término. Quando o término chegar, sinaliza para a equipe enviar manualmente o comparativo (primeira × última foto) à paciente.

**UI:**
- Nova aba `Acompanhamento` (ícone `Images` ou `Camera`).
- Lista de pacientes em acompanhamento (cards com foto de capa, nome, data início/fim, status).
- Indicador visual ("⚠️ Pronto para envio") quando `data_fim_tratamento <= hoje`.
- Barra de pesquisa.
- Ao clicar num card → tela/dialog de detalhe com:
  - Galeria de fotos em ordem cronológica (com data de cada upload).
  - Upload de novas fotos (drag & drop / botão).
  - Campo de data de fim do tratamento (DatePicker pt-BR).
  - Notas de evolução (opcional, por foto).
  - Botão **"Gerar comparativo Antes/Depois"**: monta uma view lado-a-lado da primeira e última foto.
  - Botão **"Baixar comparativo"** (gera imagem combinada via canvas em PNG para download manual — sem envio automático).
  - Botão **"Marcar como enviado"** para limpar o alerta.
- No `EventDetailDialog`, botão **"Abrir acompanhamento"** que leva direto ao paciente.

---

## 3. Estrutura de banco (novas tabelas no Supabase)

### Tabela `Anamnese_DrColageno_Piracicaba`
```text
id                    bigint PK (identity)
created_at            timestamptz default now()
agendamento_id        bigint FK -> Agendamento_DrColageno_Piracicaba(id)
paciente_nome         text         -- snapshot do nome (caso o agendamento mude)
data_anamnese         date
queixa_principal      text
historico_saude       text
alergias              text
medicamentos          text
cirurgias_previas     text
gestante              boolean
procedimentos_anteriores text
tabagismo             boolean
etilismo              boolean
tipo_pele             text
exposicao_solar       text
observacoes           text
```
RLS: pública (igual ao padrão atual do projeto em preview).

### Tabela `Acompanhamento_DrColageno_Piracicaba`
```text
id                    bigint PK (identity)
created_at            timestamptz default now()
agendamento_id        bigint FK -> Agendamento_DrColageno_Piracicaba(id)
paciente_nome         text
data_inicio           date default current_date
data_fim_tratamento   date
status                text       -- 'em_andamento' | 'pronto_envio' | 'enviado'
observacoes           text
```

### Tabela `Acompanhamento_Fotos_DrColageno_Piracicaba`
```text
id                    bigint PK (identity)
created_at            timestamptz default now()
acompanhamento_id     bigint FK -> Acompanhamento_DrColageno_Piracicaba(id) ON DELETE CASCADE
foto_url              text       -- URL pública do Supabase Storage
foto_path             text       -- caminho no bucket (para deleção)
data_foto             date default current_date
ordem                 int        -- ordem manual opcional
nota                  text
```

### Storage
Bucket público novo: `acompanhamento-fotos`
Estrutura de pastas: `{acompanhamento_id}/{timestamp}-{filename}`

---

## 4. Detalhes técnicos

**Novos arquivos:**
- `src/hooks/useAnamneses.ts` — query/insert/update/delete via `supabase.from('Anamnese_DrColageno_Piracicaba')`.
- `src/hooks/useAcompanhamentos.ts` — CRUD de acompanhamento + fotos + upload no Storage.
- `src/components/anamnese/AnamneseView.tsx` — lista + busca.
- `src/components/anamnese/AnamneseFormDialog.tsx` — form completo (cadastro/edição).
- `src/components/acompanhamento/AcompanhamentoView.tsx` — lista de pacientes + alertas.
- `src/components/acompanhamento/AcompanhamentoDetailDialog.tsx` — galeria + upload + datepicker + comparativo.
- `src/components/acompanhamento/ComparativoCanvas.tsx` — gera PNG lado-a-lado (canvas) com botão de download.

**Edições:**
- `src/pages/Index.tsx` — adicionar dois `TabsTrigger`/`TabsContent`.
- `src/components/calendar/EventDetailDialog.tsx` — dois botões de atalho (anamnese e acompanhamento).

**Migrations:**
- Criar SQL migration com as 3 tabelas + bucket + policies RLS públicas (consistente com o padrão atual do projeto).

**Comparativo antes/depois:** desenhar as duas fotos lado-a-lado num `<canvas>`, com nome da clínica e data, e disparar download via `canvas.toBlob` + link `download`. Sem envio automático — apenas download manual.

---

## Fora de escopo (confirmar antes de implementar se quiser incluir)

- Envio automático por WhatsApp/E-mail.
- Edição/anotação visual sobre as fotos.
- Versão imprimível/PDF da anamnese.
