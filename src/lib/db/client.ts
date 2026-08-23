import "server-only";

/**
 * Ponto de entrada do banco para código de servidor do Next.
 * A implementação vive em ./driver — separada para que os scripts de CLI
 * (npm run db:*, create-user) possam reusá-la fora do runtime do Next.
 */
export { query, queryOne, type QueryResult } from "./driver";
