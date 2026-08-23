import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, CheckCircle2, PlayCircle } from "lucide-react";
import { BackgroundVideo } from "@/components/app/background-video";
import { Logo } from "@/components/app/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const HIGHLIGHTS = [
  { icon: PlayCircle, text: "Videoaulas curtas, retomadas exatamente de onde você parou." },
  { icon: BookOpen, text: "Material em PDF acompanhando cada aula." },
  { icon: CheckCircle2, text: "Progresso registrado automaticamente, aula por aula." },
];

export default function LoginPage() {
  return (
    <main className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Coluna do formulário */}
      <div className="flex flex-col px-6 py-10 sm:px-10 lg:px-16">
        <Link href="/" aria-label="Voltar para a página inicial" className="w-fit">
          <Logo />
        </Link>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">
            <header className="mb-8 space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Bem-vindo de volta
              </h1>
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                Entre com os dados que você recebeu por e-mail para continuar seus estudos.
              </p>
            </header>

            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <LoginForm />
            </Suspense>

            {process.env.NODE_ENV !== "production" && (
              <div className="bg-muted/50 text-muted-foreground mt-8 rounded-lg border border-dashed px-4 py-3 text-[13px] leading-relaxed">
                <p className="text-foreground mb-1 font-medium">Acesso de demonstração</p>
                <p className="font-mono">aluno@demo.com · demo1234</p>
              </div>
            )}
          </div>
        </div>

        <p className="text-muted-foreground text-xs">
          © {new Date().getFullYear()} Fluently. Todos os direitos reservados.
        </p>
      </div>

      {/* Painel de marca */}
      <aside className="bg-brand text-brand-foreground relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-end">
        <BackgroundVideo
          src="/video/hero-bg.mp4"
          poster="/video/hero-poster.jpg"
          loadOn="(min-width: 1024px)"
        />
        <div aria-hidden className="bg-brand/70 absolute inset-0" />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -right-32 size-[34rem] rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-48 -left-24 size-[28rem] rounded-full bg-black/10 blur-3xl"
        />

        <div className="relative z-10 max-w-lg p-16">
          <p className="text-[2rem] leading-[1.25] font-medium tracking-tight text-balance">
            O inglês trava quando o estudo é solto. Aqui ele tem ordem, ritmo e um
            próximo passo claro.
          </p>

          <ul className="mt-12 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-[15px] text-white/85">
                <Icon className="mt-0.5 size-[18px] shrink-0" strokeWidth={1.75} />
                <span className="leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  );
}
