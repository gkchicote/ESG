import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Envio de e-mail transacional por SMTP.
 *
 * Um SMTP comum (a caixa do próprio domínio na Hostinger, Zoho, Gmail) em vez
 * de uma API de terceiro: o domínio já tem a caixa, não entra mais um serviço
 * com chave para girar, e o remetente é o mesmo endereço que os alunos já
 * reconhecem.
 *
 * Sem `SMTP_HOST` o envio não falha: a mensagem vai para o console do
 * servidor. É o que faz o fluxo de recuperação de senha ser testável em
 * desenvolvimento sem nenhuma credencial — em produção, a ausência da
 * variável aparece como aviso no log de boot da ação.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  /** Corpo em texto puro. É o que clientes sem HTML mostram. */
  text: string;
  html?: string;
};

export type SmtpConfig = {
  host: string;
  port: number;
  /** TLS direto na conexão (porta 465). Na 587 o TLS entra via STARTTLS. */
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};

/** null = SMTP não configurado neste ambiente. */
export function smtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT ?? 587);
  return {
    host,
    port,
    // Configurável, mas o padrão certo vem da porta: 465 é TLS implícito.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? "no-reply@localhost",
  };
}

export function isEmailConfigured(): boolean {
  return smtpConfig() !== null;
}

// O transporter mantém o pool de conexões SMTP; recriá-lo a cada envio abriria
// (e negociaria TLS de) uma conexão nova por e-mail. Sobrevive ao hot-reload.
const globalForMail = globalThis as unknown as { __lmsMailer?: Transporter };

function transporter(config: SmtpConfig): Transporter {
  globalForMail.__lmsMailer ??= nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
    pool: true,
  });
  return globalForMail.__lmsMailer;
}

/**
 * Envia a mensagem. Devolve `false` quando o envio falhou — quem chama decide
 * o que mostrar na tela, e no caso da recuperação de senha a resposta é a
 * mesma de qualquer jeito, para não revelar quais e-mails existem.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const config = smtpConfig();

  if (!config) {
    console.warn(
      `\n  ! SMTP não configurado — e-mail não enviado (veja .env.example).\n` +
        `    Para: ${message.to}\n    Assunto: ${message.subject}\n\n${message.text}\n`,
    );
    return false;
  }

  try {
    await transporter(config).sendMail({
      from: config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return true;
  } catch (error) {
    console.error("  ! Falha ao enviar e-mail:", error);
    return false;
  }
}
