-- ============================================================
-- Execute no SQL Editor do Supabase (projeto: ehlpmukjdknnyhkycncb)
-- Adiciona coluna Procedimento à tabela de agendamentos
-- ============================================================

ALTER TABLE public."Agendamento_DrColageno_Piracicaba"
ADD COLUMN IF NOT EXISTS "Procedimento" text;
