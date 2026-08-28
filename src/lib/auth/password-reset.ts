import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Token de redefinição de senha.
 *
 * O valor cru só existe em dois lugares: no link que sai no e-mail e na URL
 * que a pessoa abre. No banco fica o SHA-256 dele — assim um dump, um backup
 * ou um log de query não entregam a conta de ninguém. Não tem "salt" nem
 * bcrypt porque o token já é aleatório de 256 bits: não há dicionário para
 * atacar, e a busca precisa ser por igualdade exata do hash.
 */

/** 1 hora. Curto o bastante para o link não virar uma chave esquecida na caixa. */
export const RESET_TTL_MS = 60 * 60 * 1000;

export function createResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashResetToken(token) };
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Compara dois hashes em tempo constante.
 *
 * A busca no banco é por índice único (`token_hash`), então o resultado já
 * veio pela chave — isto cobre o caso de a comparação passar a ser feita em
 * memória, e custa nada.
 */
export function resetTokenMatches(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Corpo do e-mail de recuperação. */
export function resetEmail(fullName: string, link: string) {
  const firstName = fullName.trim().split(/\s+/)[0] ?? fullName;

  const text = [
    `Olá, ${firstName}.`,
    "",
    "Recebemos um pedido para redefinir a senha da sua conta na Fluently.",
    "Abra o link abaixo para escolher uma senha nova:",
    "",
    link,
    "",
    "O link vale por 1 hora e só pode ser usado uma vez.",
    "Se não foi você quem pediu, ignore este e-mail — sua senha continua a mesma.",
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#171717;max-width:32rem">
      <p>Olá, ${escapeHtml(firstName)}.</p>
      <p>Recebemos um pedido para redefinir a senha da sua conta na Fluently.</p>
      <p style="margin:28px 0">
        <a href="${escapeHtml(link)}"
           style="background:#2f5fd8;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:600">
          Escolher nova senha
        </a>
      </p>
      <p style="color:#666;font-size:14px">
        O link vale por 1 hora e só pode ser usado uma vez.<br>
        Se não foi você quem pediu, ignore este e-mail — sua senha continua a mesma.
      </p>
      <p style="color:#999;font-size:12px;word-break:break-all">${escapeHtml(link)}</p>
    </div>
  `;

  return { subject: "Redefinir sua senha — Fluently", text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
