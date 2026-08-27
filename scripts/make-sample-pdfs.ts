/**
 * Gera PDFs de demonstração em content/pdfs, um por material do catálogo.
 * Substitua os arquivos pelos seus materiais reais mantendo o mesmo nome.
 */
import fs from "node:fs";
import path from "node:path";
import { CURRICULUM } from "../src/lib/db/catalog";

const esc = (s: string) => s.replace(/([\\()])/g, "\\$1");

/** Remove acentos: a fonte Helvetica base do PDF usa WinAnsi. */
const plain = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function buildPdf(title: string, lines: string[]): Buffer {
  const content =
    `BT /F1 20 Tf 56 762 Td (${esc(plain(title))}) Tj ET\n` +
    `0.6 w 56 748 m 539 748 l S\n` +
    lines
      .map((l, i) => `BT /F1 12 Tf 56 ${716 - i * 22} Td (${esc(plain(l))}) Tj ET`)
      .join("\n") +
    `\nBT /F1 9 Tf 56 60 Td (Fluently - material de apoio) Tj ET`;

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const [i, obj] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

const dir = path.join(process.cwd(), "content", "pdfs");
fs.mkdirSync(dir, { recursive: true });

let count = 0;
for (const [mi, module] of CURRICULUM.entries()) {
  for (const lesson of module.lessons) {
    // Material com caminho (content/materials/...) é arquivo real do curso;
    // o gerador só cobre os PDFs de demonstração soltos em content/pdfs.
    for (const material of (lesson.materials ?? []).filter((m) => !m.file.includes("/"))) {
      const lines = [
        `Modulo ${mi + 1}: ${module.title}`,
        `Aula: ${lesson.title}`,
        "",
        lesson.description,
        "",
        "Este e um arquivo de demonstracao. Substitua-o pelo material real",
        `mantendo o nome do arquivo: ${material.file}`,
      ];
      fs.writeFileSync(path.join(dir, material.file), buildPdf(material.title, lines));
      count += 1;
    }
  }
}

console.log(`✓ ${count} PDFs de demonstração gerados em content/pdfs`);
