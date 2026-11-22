// Notificação de PRESENÇA para o n8n — uma fonte só, usada pelo modal de
// detalhes e pela marcação rápida da agenda (card do dia / painel de
// pendências). Antes o payload existia só dentro do modal; duplicar significaria
// duas verdades sobre o que o n8n recebe.
//
// São DOIS webhooks independentes com o MESMO payload:
//   webhookPresenca     -> mensagem ao paciente (NPS se compareceu, aviso de
//                          falta se faltou — é o "trazer o paciente de volta")
//   webhookPresencaCard -> card do paciente no funil do WTS (ganho x Faltou)
// Separados de propósito: falha na sincronização do card não pode atrasar nem
// impedir a mensagem ao paciente.
//
// ATENÇÃO ao valor de `presenca`: o nó "If Compareceu" do n8n compara com
// "Compareceu" EXATO. Qualquer outro texto cai no ramo de falta. Por isso a UI
// grava sempre um dos valores canônicos de PRESENCA (agendamento-status.ts).
import type { UnitConfig } from "@/config/units";
import { firePainelWebhook } from "@/lib/painel-webhook";

export interface AlvoPresenca {
  Nome: string | null;
  "Número": string | null;
  Canal: string | null;
  Data: string | null;
}

export function notificaPresenca(
  cfg: UnitConfig | undefined,
  unidade: string,
  alvo: AlvoPresenca,
  presenca: string,
  // Data EFETIVA da linha: se o mesmo save também remarcou, a linha no banco já
  // é a nova, e é por (Número, Data) que o n8n acha a linha de volta.
  data?: string | null,
) {
  const payload = {
    evento: "presenca",
    unidade,
    // Quem resolve a unidade no WTS é o canal, não o slug: a agenda geral
    // atende as duas clínicas.
    canal: alvo.Canal,
    presenca,
    nome: alvo.Nome,
    telefone: alvo["Número"],
    data: data ?? alvo.Data,
  };
  firePainelWebhook(cfg?.webhookPresenca, payload);
  firePainelWebhook(cfg?.webhookPresencaCard, payload);
  return payload;
}
