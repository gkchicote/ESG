/**
 * Aplica o catálogo (src/lib/db/catalog.ts) num banco que já existe.
 *
 *   npm run content:sync
 *   npm run content:sync -- --curso outro-slug
 *
 * Mesma operação do botão "Publicar catálogo" da página de administração —
 * use este quando o banco for alcançável da sua máquina.
 */
import { syncCurriculum } from "../src/lib/db/sync-curriculum";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  console.log("");
  const summary = await syncCurriculum({
    courseSlug: arg("curso"),
    log: (line) => console.log(`  ${line}`),
  });

  console.log(
    `\n  ✓ ${summary.modules} módulos e ${summary.lessons} aulas em "${summary.courseTitle}"` +
      ` — ${summary.created} criadas, ${summary.updated} atualizadas, ${summary.removed} removidas.\n`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
