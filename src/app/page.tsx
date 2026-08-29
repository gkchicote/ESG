import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, LogIn, PlayCircle } from "lucide-react";
import { BackgroundAudio } from "@/components/app/background-audio";
import { BackgroundVideo } from "@/components/app/background-video";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Fluently — Fluency is a habit",
  description:
    "Short daily lessons, real practice and a clear next step every time you come back.",
};

const PROOF = [
  { icon: PlayCircle, text: "Short lessons that pick up exactly where you left off" },
  { icon: CheckCircle2, text: "Progress tracked automatically, lesson by lesson" },
];

export default function LandingPage() {
  return (
    /* A landing é sempre escura: o vídeo é o fundo, então o tema claro do
       usuário não se aplica aqui. Cores fixas, sem tokens de tema. */
    <main className="relative flex min-h-svh flex-col overflow-hidden bg-neutral-950 text-white">
      <BackgroundVideo
        src="/video/login-bg.mp4"
        mobileSrc="/video/login-bg-mobile.mp4"
        poster="/video/login-poster.jpg"
      />

      {/* Escurecimento para o texto ficar legível sobre qualquer frame */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-neutral-950/90 via-neutral-950/55 to-neutral-950/20"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-transparent to-neutral-950/50"
      />

      {/* Topo ------------------------------------------------------- */}
      <header className="relative z-10 flex items-center justify-between gap-4 px-6 py-6 sm:px-10 sm:py-8">
        <Logo />

        <Button
          asChild
          className="h-10 gap-2 bg-white px-5 font-semibold text-neutral-900 hover:bg-white/90"
        >
          <Link href="/login">
            <LogIn className="size-4" />
            Log in
          </Link>
        </Button>
      </header>

      {/* Herói ------------------------------------------------------ */}
      <div className="relative z-10 flex flex-1 items-center px-6 pb-20 sm:px-10">
        <div className="max-w-2xl">
          <p className="mb-5 text-[11px] font-semibold tracking-[0.22em] text-white/60 uppercase">
            English, every single day
          </p>

          <h1 className="text-[clamp(2.75rem,7vw,4.75rem)] leading-[1.02] font-semibold tracking-[-0.03em] text-balance">
            Fluency is a habit,{" "}
            <br className="hidden sm:block" />
            not a talent.
          </h1>

          <p className="mt-7 max-w-lg text-lg leading-relaxed text-white/70">
            Twenty minutes a day beats twenty hours once a month. Show up, press
            play, and let the streak do the hard part for you.
          </p>

          <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="h-12 w-full gap-2.5 bg-white px-7 text-[15px] font-semibold text-neutral-900 hover:bg-white/90 sm:w-auto"
            >
              <Link href="/login">
                Enter the platform
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <ul className="mt-12 space-y-3 sm:mt-14">
            {PROOF.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-white/60">
                <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <footer className="relative z-10 px-6 pb-7 text-xs text-white/40 sm:px-10">
        © {new Date().getFullYear()} Fluently
      </footer>

      <BackgroundAudio
        src="/audio/hero-bg.mp3"
        className="fixed right-6 bottom-6 z-20 sm:right-10 sm:bottom-7"
      />
    </main>
  );
}
