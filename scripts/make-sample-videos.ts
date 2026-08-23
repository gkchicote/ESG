/**
 * Gera videoaulas de demonstração em content/videos (MP4 H.264 + AAC).
 *
 * Existe só para você conseguir testar a plataforma antes de subir o material
 * real. Para usar seus vídeos: coloque os MP4 nessa mesma pasta e aponte
 * `lessons.video_id` para o nome do arquivo.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import { CURRICULUM } from "../src/lib/db/catalog";

const OUT = path.join(process.cwd(), "content", "videos");

fs.mkdirSync(OUT, { recursive: true });

const manifest: Record<string, { file: string; seconds: number }> = {};
let done = 0;
const total = CURRICULUM.reduce((n, m) => n + m.lessons.length, 0);

for (const [mi, module] of CURRICULUM.entries()) {
  for (const [li, lesson] of module.lessons.entries()) {
    const file = `${lesson.slug}.mp4`;
    const target = path.join(OUT, file);
    manifest[lesson.slug] = { file, seconds: lesson.seconds };

    if (fs.existsSync(target)) {
      done += 1;
      continue;
    }

    // Padrão de teste com contador de tempo embutido (confirma que o
    // "retomar de onde parou" salta para o segundo certo) + uma cor por
    // módulo e uma barra branca que avança até o fim.
    const hue = (mi * 61 + li * 17) % 360;
    const filters = [
      `hue=h=${hue}:s=0.85`,
      `drawbox=x=0:y=ih-12:w=iw*t/${lesson.seconds}:h=12:color=white@0.9:t=fill`,
    ];

    if (!ffmpeg) throw new Error("ffmpeg-static não encontrado. Rode: npm install");

    execFileSync(
      ffmpeg,
      [
        "-y", "-loglevel", "error",
        "-f", "lavfi", "-i", `testsrc2=s=1280x720:r=25:d=${lesson.seconds}`,
        "-f", "lavfi", "-i", `anullsrc=channel_layout=stereo:sample_rate=44100:d=${lesson.seconds}`,
        "-vf", filters.join(","),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "32", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "48k",
        "-movflags", "+faststart",
        "-shortest",
        target,
      ],
      { stdio: "inherit" },
    );

    done += 1;
    process.stdout.write(`\r  gerando videoaulas... ${done}/${total}`);
  }
}

fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\n✓ ${total} videoaulas de demonstração em content/videos`);
