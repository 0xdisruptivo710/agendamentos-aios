-- ============================================================
-- Execute no SQL Editor do Supabase (projeto: ehlpmukjdknnyhkycncb)
-- Adiciona telefone do paciente em Anamnese e Acompanhamento
-- ============================================================

ALTER TABLE public."Anamnese_DrColageno_Piracicaba"
  ADD COLUMN IF NOT EXISTS paciente_telefone text;

ALTER TABLE public."Acompanhamento_DrColageno_Piracicaba"
  ADD COLUMN IF NOT EXISTS paciente_telefone text;
