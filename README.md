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
| Vídeo | Cloudflare R2 (bucket privado, URL assinada); arquivo local com `Range` em dev |

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
content/materials/         Anexos/áudio com storage "file" (content/materials/<slug-da-aula>/)
src/app/login/             Tela de login
src/app/(app)/inicio/      Dashboard
src/app/(app)/modulos/     Módulos em accordion
src/app/(app)/aula/[id]/   Player + lista lateral
src/app/api/video/[id]/    Streaming com suporte a Range
src/app/api/materials/[id] Entrega de anexos e áudio (Range) com checagem de matrícula
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

**Em produção o vídeo vem do Cloudflare R2** (veja abaixo). Em desenvolvimento
dá para trabalhar com o arquivo em disco: copie o MP4 para `content/videos/` e
cadastre a aula com `video_provider = 'file'` e
`video_id = 'nome-do-arquivo.mp4'`. No catálogo isso é o padrão: sem o campo
`video`, a aula procura `<slug>.mp4`.

Provedores suportados (`src/lib/video.ts`):

| `video_provider` | `video_id` |
| --- | --- |
| `r2` | chave do objeto no bucket (ex.: `F-MODULO03/M03V20 - The Endless Tale 01.mp4`) |
| `file` | nome do arquivo em `content/videos/` |
| `url` | URL http(s) direta de um MP4/HLS |
| `bunny` | GUID do vídeo (requer `BUNNY_LIBRARY_ID` no `.env`) |
| `youtube` / `vimeo` / `drive` | ID do vídeo |

**Cloudflare R2.** É onde as videoaulas moram. O bucket é **privado**: nada nele
abre sem assinatura. Suba o MP4 pelo painel do R2 e cadastre a aula com a chave
exata do objeto — com espaços, maiúsculas e a pasta do módulo, igualzinho ao que
aparece na listagem:

```ts
{ slug: "the-endless-tale-01", title: "Aula 01 - The Endless Tale",
  description: "", seconds: 1354,
  video: r2("F-MODULO03/M03V20 - The Endless Tale 01.mp4") }
```

O caminho de entrega: o player aponta para `/api/video/[lessonId]`, a rota
confere a matrícula do aluno, assina uma URL de 6 horas (`src/lib/r2.ts`, SigV4
feito à mão — sem o SDK da AWS) e devolve um `302`. O MP4 então viaja do
Cloudflare direto para o aluno, sem passar pela banda do servidor, e o segredo
nunca chega ao navegador. Como é um `<video>` nativo, essas aulas têm o pacote
completo: retomar de onde parou, arrastar a linha do tempo e conclusão
automática aos 90%.

Preencha as quatro variáveis `R2_*` do `.env.example` (as chaves saem de
**R2 → Manage API Tokens**; basta permissão de leitura). Sem elas, aulas com
`provider: "r2"` respondem `503`.

Para descobrir a duração real de um vídeo já no bucket, sem baixá-lo:

```bash
ffmpeg -i "<url assinada>"   # leia o campo Duration
```

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

**Google Drive.** Faça upload do MP4, mude o compartilhamento para "Qualquer
pessoa com o link" (leitor) e pegue o ID do link
(`https://drive.google.com/file/d/<ID>/view` → `<ID>`):

```ts
{ slug: "jack-hannaford-01", title: "Aula 01 - Jack Hannaford",
  description: "", seconds: 1802,
  video: { provider: "drive", id: "SEU_ID_AQUI" } }
```

**Evite usar em produção.** Na prática o Drive tem o mesmo problema do YouTube:
sinaliza arquivos automaticamente como "suspeitos" e trava o acesso a "só o
proprietário", mesmo com o compartilhamento certo — sem aviso prévio, e sem
relação com direitos autorais de fato. Fora isso, não expõe API de progresso
(essas aulas caem no embed simples, sem retomar de onde parou nem concluir
sozinhas aos 90%) e ainda impõe cota diária de download por arquivo — com
muitos alunos acessando ao mesmo tempo, a aula pode parar de abrir para todo
mundo. Prefira sempre `file` (MP4 no seu próprio servidor); este provider fica
disponível só para quem tiver conteúdo que comprovadamente não seja sinalizado.

### 2. Anexos e áudio das aulas

Declarados na aula, dentro de `src/lib/db/catalog.ts`, com um `storage` por
item — mesma ideia do `video_provider` da aula:

```ts
materials: [{ title: "Texto da aula", file: "materials/jack-hannaford-01/texto.pdf", type: "pdf" }],  // storage: "file" (padrão)
audios:    [{ voice: "Jake", file: "F-MODULO02/Módulo 02/Aula 01/AUDIO Jack Hannaford 01 Jake.mp3", storage: "r2" }],
```

- **`storage: "file"`** (padrão) — `file` é o caminho relativo a `content/`; um
  nome solto, sem barra, continua sendo lido de `content/pdfs/`. Serve para
  anexo pequeno que não vale a pena hospedar fora do repositório.
- **`storage: "r2"`** — `file` é a chave completa do objeto no bucket privado
  (a mesma ideia do vídeo). Uso recomendado para os áudios e PDFs de módulos
  reais: evita depender do disco do servidor (o volume do Docker só existe se
  alguém colocar o arquivo lá) e não engorda o repositório Git.

  **Cuidado com acentos:** um arquivo enviado a partir de um Mac é salvo em
  disco com os nomes em **NFD** (o "ó" vira "o" + acento combinante — bytes
  diferentes de um "ó" comum digitado num editor, mesmo parecendo idêntico na
  tela). A chave no R2 herda essa codificação. Se a chave em `catalog.ts` for
  digitada à mão em vez de copiada, normalize com `.normalize("NFD")` antes de
  montá-la — senão a assinatura bate com um objeto que não existe e a API
  devolve 404 mesmo com o nome "certo" aparecendo no log. `jackHannaford()`
  em `catalog.ts` faz isso; é o padrão a seguir para qualquer pasta nova vinda
  de um Mac.

Rode `npm run content:sync` (ou clique em "Publicar catálogo" em `/admin`) para
gravar em `materials`. O tamanho de cada arquivo é lido do disco (`file`) ou de
uma listagem do bucket (`r2`, uma chamada por pasta) na hora do sync, e aparece
na tela; fica `null` se o arquivo ainda não estiver no lugar — não é erro
bloqueante.

`materials` vira a lista de download em **Material da aula**; `audios` vira o
player de **Áudio da aula**, com um botão por voz — é a mesma gravação lida por
narradores diferentes, e trocar de voz no meio não interrompe a reprodução.

Nada é servido estaticamente: tudo passa por `/api/materials/[id]`, que valida
a matrícula antes de entregar o arquivo. No provider `file`, o streaming
implementa `Range` na mão; no `r2`, é um 302 para uma URL assinada de vida
curta (o navegador reemite o `Range` na URL de destino). O player de áudio
precisa disso para arrastar a linha do tempo, e o Safari para sequer tocar.

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
3. **Vídeo** — suba os MP4 para o bucket do Cloudflare R2 e preencha as quatro
   variáveis `R2_*`. O bucket fica privado e a saída de dados do R2 não é
   cobrada, então o número de alunos não mexe na conta.
4. **Deploy** — Vercel. `content/pdfs` e o que estiver em `content/materials`
   com `storage: "file"` cabem no repositório; para anexos maiores (áudio,
   PDFs pesados), prefira `storage: "r2"` — sobe uma vez para o mesmo bucket
   do vídeo e nenhum arquivo depende do disco do servidor ou do volume do
   Docker. `content/materials` continua montado como volume (igual a
   `content/pdfs`) para quem preferir `storage: "file"`.

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
