# Fluently — Plataforma de Estudos de Inglês (LMS)

Aplicação de curso online: login, dashboard com progresso, módulos em accordion
e player de aula com material em PDF.

---

## Rodando localmente

```bash
npm install
npm run dev
```

Abra <http://localhost:3000>.

Na primeira execução o banco local é criado e populado automaticamente com um
curso de demonstração (5 módulos, 18 aulas, 10 PDFs).

**Acesso de demonstração**

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Aluno | `aluno@demo.com` | `demo1234` |
| Admin | `admin@demo.com` | `admin1234` |

> As credenciais aparecem na tela de login apenas em desenvolvimento
> (`NODE_ENV !== "production"`).

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components) + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui (Radix) + Lucide |
| Banco | PostgreSQL — **PGlite** embutido em dev, Postgres/Supabase em produção |
| Autenticação | Sessão própria: bcrypt + JWT (jose) em cookie `httpOnly` |
| Vídeo | Arquivo local com streaming por `Range`; pronto para Bunny/YouTube/Vimeo |

### Por que sessão própria em vez do Supabase Auth

Os acessos são criados manualmente por você — não há auto-cadastro, verificação
de e-mail nem OAuth. Nesse cenário, o Supabase Auth só acrescentaria dependência.
A autorização é aplicada no servidor: **toda** consulta de conteúdo passa por um
`join` com `enrollments`, então uma aula de curso não matriculado nunca é
devolvida, mesmo com o ID em mãos.

---

## Estrutura

```
db/schema.sql              Schema Postgres (roda igual em PGlite e Supabase)
content/videos/            MP4 das aulas  (fora do Git)
content/pdfs/              Materiais em PDF
src/app/login/             Tela de login
src/app/(app)/inicio/      Dashboard
src/app/(app)/modulos/     Módulos em accordion
src/app/(app)/aula/[id]/   Player + lista lateral
src/app/api/video/[id]/    Streaming com suporte a Range
src/app/api/materials/[id] Download de PDF com checagem de matrícula
src/app/api/progress/      Gravação final da posição (sendBeacon)
src/lib/db/                Driver, queries e seed
src/lib/auth/              Sessão, hash de senha e Server Actions
src/proxy.ts               Proteção de rotas (antigo middleware)
```

### Modelo de dados

```
profiles ──< enrollments >── courses ──< modules ──< lessons ──< materials
    └──────< lesson_progress >───────────────────────────┘
```

- `enrollments.last_lesson_id` + `last_accessed_at` alimentam o card
  "continuar de onde parou" e o indicador de último acesso.
- `lesson_progress.last_position_seconds` retoma o vídeo no segundo exato.
- A view `course_progress` calcula a barra de 0 a 100% em SQL.

---

## Colocando o seu conteúdo

### 0. O catálogo

`src/lib/db/catalog.ts` é a fonte única do curso, dos módulos e das aulas.
Edite o arquivo e aplique no banco de uma das duas formas:

- **Pelo painel** — entre como admin em `/admin` e clique em **Publicar
  catálogo**. É o caminho para produção, onde o Postgres costuma só ser
  alcançável de dentro da rede do container.
- **Pelo terminal** — `npm run content:sync` (ou com `DATABASE_URL=…` na
  frente, se o banco for alcançável da sua máquina).

O seed só roda quando o banco é criado do zero — e **só no PGlite local**. Num
deploy com `DATABASE_URL` nada é populado automaticamente: o curso precisa ser
publicado uma vez pelo painel, e de novo a cada módulo ou aula acrescentada. Ele casa as linhas pelo **`slug`**: aula que
já existe é atualizada e o progresso dos alunos é preservado; aula que sumiu do
catálogo é apagada. Renomear o título é seguro — trocar o slug não é.

### 1. Vídeos

Copie os MP4 para `content/videos/` e cadastre a aula com
`video_provider = 'file'` e `video_id = 'nome-do-arquivo.mp4'`. No catálogo isso
é o padrão: sem o campo `video`, a aula procura `<slug>.mp4`.

Outros provedores já suportados (`src/lib/video.ts`):

| `video_provider` | `video_id` |
| --- | --- |
| `file` | nome do arquivo em `content/videos/` |
| `url` | URL http(s) direta de um MP4/HLS |
| `bunny` | GUID do vídeo (requer `BUNNY_LIBRARY_ID` no `.env`) |
| `youtube` / `vimeo` | ID do vídeo |

**YouTube.** Basta o ID de 11 caracteres do link
(`https://youtu.be/zdXmqqPBXEQ` → `zdXmqqPBXEQ`):

```ts
{ slug: "jack-hannaford-01", title: "Aula 01 - Jack Hannaford",
  description: "", seconds: 1802,
  video: { provider: "youtube", id: "zdXmqqPBXEQ" } }
```

Vale para vídeo **não listado** — o embed depende do ID, não de o vídeo aparecer
na busca. Só não pode ser *privado*, e no YouTube Studio a incorporação precisa
estar liberada (Detalhes → Mostrar mais → *Permitir incorporação*).

O player usa a IFrame API do YouTube, então essas aulas se comportam como as de
MP4: salvam a posição a cada 10 s, retomam de onde o aluno parou e se marcam
como concluídas aos 90%. Preencha `seconds` com a duração real do vídeo — é o
que a lista de aulas exibe; aula com `0` aparece como `—`.

Aula já publicada cujo vídeo ainda não subiu: `id: null`. Ela entra na lista e
o palco mostra "O vídeo desta aula ainda não foi publicado".

### 2. PDFs

Copie para `content/pdfs/` e cadastre em `materials.storage_path` com o nome do
arquivo. O download nunca é servido estaticamente: passa por
`/api/materials/[id]`, que valida a matrícula antes de entregar o arquivo.

### 3. Liberando o curso para o aluno

Quem manda no acesso é a matrícula (`enrollments`): sem ela o aluno entra e vê
"Nenhum curso liberado ainda". Em `/admin`, a coluna **Curso** de cada usuário
define isso na hora — escolha o curso para liberar, ou "Sem acesso" para tirar.

Tirar o acesso não apaga o progresso: se a matrícula voltar, o aluno retoma
exatamente de onde parou.

### 4. Criando acessos de aluno

```bash
npm run create-user -- --email ana@exemplo.com --nome "Ana Duarte" --senha "trocar123"
```

Cria (ou atualiza) o perfil e matricula no primeiro curso publicado.
Use `--curso <slug>` para escolher outro e `--papel admin` para um administrador.

---

## Indo para produção

1. **Banco** — crie um projeto no Supabase, rode `db/schema.sql` no SQL Editor e
   preencha `DATABASE_URL` no `.env`. O app troca de driver sozinho; nenhuma
   query muda.
2. **Sessão** — defina `SESSION_SECRET` (`openssl rand -base64 32`). Sem isso,
   um segredo de desenvolvimento é usado.
3. **Vídeo** — suba os MP4 para o Bunny Stream (ou Cloudflare Stream), troque
   `video_provider` para `bunny` e preencha `BUNNY_LIBRARY_ID`. Serve HLS
   adaptativo e evita expor o arquivo original.
4. **Deploy** — Vercel. `content/pdfs` cabe no repositório; se os materiais
   crescerem, migre para o Supabase Storage e troque a leitura de disco em
   `src/app/api/materials/[id]/route.ts` por uma signed URL (há um comentário
   no arquivo indicando o ponto exato).

---

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `start` | Build e execução em produção |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run create-user` | Cria acesso de aluno e matrícula |
| `npm run db:reset` | Apaga o banco local (recriado no próximo `dev`) |
| `npm run content:pdfs` | Regera os PDFs de demonstração |
| `npm run content:videos` | Regera as videoaulas de demonstração (ffmpeg) |
| `npm run content:sync` | Aplica o catálogo (módulos e aulas) num banco existente |

---

## Conteúdo de demonstração

Os vídeos e PDFs incluídos são gerados por script, apenas para testar a
plataforma antes do material real:

- **Vídeos** — padrão de teste colorido com contador de tempo na tela (útil para
  conferir que o "retomar de onde parou" volta ao segundo certo) e barra de
  progresso branca. 24 a 46 segundos cada.
- **PDFs** — uma página com o título do material e a aula correspondente.

Ambos são descartáveis: apague os arquivos e coloque os seus.
# ESG
