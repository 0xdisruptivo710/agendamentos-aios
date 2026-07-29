// Notifica o n8n sobre eventos do painel (agendamento criado, presença
// registrada). Fire-and-forget: o envio da mensagem é responsabilidade do
// n8n; falha de rede aqui NUNCA bloqueia nem quebra a UI — a recepção já
// salvou o agendamento, a mensagem é um efeito colateral best-effort.
export function firePainelWebhook(url: string | undefined, payload: Record<string, unknown>) {
  if (!url) return;
  try {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // keepalive: o POST sobrevive se a aba fechar logo após salvar.
      keepalive: true,
    }).catch(() => {});
  } catch {
    // nunca propaga
  }
}
