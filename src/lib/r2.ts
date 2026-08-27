import crypto from "node:crypto";

/**
 * Cloudflare R2 — geração de URL assinada (presigned) para leitura.
 *
 * O bucket fica **privado**: nada nele é alcançável sem assinatura. Quem assina
 * é o servidor, depois de conferir a matrícula do aluno em
 * `/api/video/[lessonId]`, que devolve um 302 para a URL gerada aqui. Assim o
 * MP4 sai direto do R2 (com suporte a Range, então o player continua podendo
 * arrastar a linha do tempo) sem passar pela banda do VPS, e o segredo nunca
 * chega ao navegador.
 *
 * A assinatura é SigV4 e é pura aritmética — não faz chamada de rede — por isso
 * dá para gerá-la de forma síncrona no meio de uma requisição. É também a razão
 * de não trazer o `@aws-sdk/client-s3`: seriam alguns MB de dependência para
 * reimplementar as ~40 linhas abaixo.
 */

const ALGORITHM = "AWS4-HMAC-SHA256";
/** R2 não tem regiões como a AWS; a assinatura exige o literal "auto". */
const REGION = "auto";
const SERVICE = "s3";

/** Validade padrão do link. Cobre a aula mais longa com folga para pausas. */
const DEFAULT_EXPIRES_SECONDS = 60 * 60 * 6;

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

/** null = R2 não configurado no ambiente (dev sem `.env.local`, por exemplo). */
export function r2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function isR2Configured(): boolean {
  return r2Config() !== null;
}

/**
 * Assina um GET no objeto `key` e devolve a URL pronta.
 * Devolve null quando o ambiente não tem as credenciais.
 *
 * `responseContentType`/`responseContentDisposition` viram os parâmetros
 * `response-content-type`/`response-content-disposition` da assinatura — a
 * API do S3 (e o R2, compatível) os aceita para sobrescrever, só nesta
 * resposta, o que o objeto tem gravado. Usado pelos materiais: o nome do
 * arquivo salvo no R2 não é o título cadastrado na aula.
 */
export function presignR2Get(
  key: string,
  {
    expiresIn = DEFAULT_EXPIRES_SECONDS,
    config = r2Config(),
    responseContentType,
    responseContentDisposition,
  }: {
    expiresIn?: number;
    config?: R2Config | null;
    responseContentType?: string;
    responseContentDisposition?: string;
  } = {},
): string | null {
  if (!config) return null;

  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${config.bucket}/${encodeKey(key)}`;

  const extraQuery: Record<string, string> = {};
  if (responseContentType) extraQuery["response-content-type"] = responseContentType;
  if (responseContentDisposition) {
    extraQuery["response-content-disposition"] = responseContentDisposition;
  }

  return sign({ config, host, canonicalUri, expiresIn, extraQuery });
}

/**
 * Lista as chaves do bucket (ou de um prefixo). Existe para os scripts de
 * conteúdo — o app em si nunca precisa listar, só assinar a chave que já está
 * gravada em `lessons.video_id`.
 */
export async function listR2Objects(
  prefix = "",
  config = r2Config(),
): Promise<{ key: string; size: number }[]> {
  if (!config) throw new Error("R2 não configurado (veja .env.example)");

  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const objects: { key: string; size: number }[] = [];
  let token: string | undefined;

  do {
    const extraQuery: Record<string, string> = { "list-type": "2", "max-keys": "1000" };
    if (prefix) extraQuery.prefix = prefix;
    if (token) extraQuery["continuation-token"] = token;

    const url = sign({
      config,
      host,
      canonicalUri: `/${config.bucket}`,
      expiresIn: 60,
      extraQuery,
    });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`R2 respondeu ${response.status}: ${await response.text()}`);
    }

    const xml = await response.text();
    for (const chunk of xml.split("<Contents>").slice(1)) {
      const key = decodeXml(chunk.match(/<Key>([\s\S]*?)<\/Key>/)?.[1] ?? "");
      const size = Number(chunk.match(/<Size>(\d+)<\/Size>/)?.[1] ?? 0);
      if (key) objects.push({ key, size });
    }

    token = xml.includes("<IsTruncated>true</IsTruncated>")
      ? decodeXml(xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ?? "")
      : undefined;
  } while (token);

  return objects;
}

/* -------------------------------------------------------------------------
 * SigV4 — query string signing
 * ---------------------------------------------------------------------- */

function sign({
  config,
  host,
  canonicalUri,
  expiresIn,
  extraQuery,
}: {
  config: R2Config;
  host: string;
  canonicalUri: string;
  expiresIn: number;
  extraQuery: Record<string, string>;
}): string {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;

  const query: Record<string, string> = {
    ...extraQuery,
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Credential": `${config.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": "host",
  };

  // A ordenação é sobre os nomes **já codificados**, como manda a spec.
  const canonicalQuery = Object.keys(query)
    .map((k) => [uriEncode(k), uriEncode(query[k])] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  // Sem hash do corpo: "UNSIGNED-PAYLOAD" é o valor exigido para presign.
  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [ALGORITHM, amzDate, scope, sha256(canonicalRequest)].join("\n");

  const signature = hmac(signingKey(config.secretAccessKey, dateStamp), stringToSign).toString(
    "hex",
  );

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function signingKey(secret: string, dateStamp: string): Buffer {
  const date = hmac(`AWS4${secret}`, dateStamp);
  const region = hmac(date, REGION);
  const service = hmac(region, SERVICE);
  return hmac(service, "aws4_request");
}

function hmac(key: string | Buffer, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256(data: string): string {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

/**
 * encodeURIComponent não escapa `!'()*`, que a AWS exige escapados — daí o
 * retoque. `/` também é escapado aqui; quem monta caminho trata segmento a
 * segmento (ver encodeKey).
 */
function uriEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Chave de objeto: cada segmento é escapado, mas as barras continuam barras. */
function encodeKey(key: string): string {
  return key.split("/").map(uriEncode).join("/");
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}
