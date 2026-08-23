import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * PGlite carrega WASM e um FS próprio em tempo de execução — precisa ficar
   * fora do bundle do servidor. `postgres` (usado quando há DATABASE_URL)
   * também prefere ser externo.
   */
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],

  /** Permite abrir o servidor de desenvolvimento por um túnel HTTPS. */
  allowedDevOrigins: ["*.trycloudflare.com"],

  /** Gera .next/standalone (server mínimo + deps traçadas) para a imagem Docker. */
  output: "standalone",
};

export default nextConfig;
