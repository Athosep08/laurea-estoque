/**
 * Texto para falhas que não são resposta de negócio: conexão caindo, erro do
 * Supabase, bug nosso. Antes essas falhas subiam como promessa rejeitada e a
 * tela não dizia nada — quem clicava em "Registrar produção" via a mesma tela,
 * sem pista de que algo deu errado. O detalhe técnico vai no fim de propósito:
 * é o que permite descobrir a causa quando alguém relata o problema.
 */
export function failureMessage(cause: unknown): string {
  const detail = technicalDetail(cause);
  if (isExpiredSession(detail)) {
    return 'Sua sessão expirou. Feche e abra o app de novo e, se pedir, faça o login outra vez.';
  }
  return `Não foi possível concluir. Tente de novo; se continuar, me mande esta mensagem: ${detail}`;
}

/** Token vencido: o Supabase responde 401 com JWT no texto, ou o código PGRST301. */
function isExpiredSession(detail: string): boolean {
  return /(^|[^A-Za-z])JWT([^A-Za-z]|$)|PGRST301|token is expired/i.test(detail);
}

function technicalDetail(cause: unknown): string {
  if (typeof cause === 'string' && cause.trim()) return cause;

  if (cause && typeof cause === 'object') {
    const { message, code, details, hint } = cause as Record<string, unknown>;
    const parts = [message, code && `código ${String(code)}`, details, hint]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .map((part) => part.trim());
    if (parts.length > 0) return parts.join(' · ');
  }

  return `erro sem descrição (${String(cause)})`;
}
