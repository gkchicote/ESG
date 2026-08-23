import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/jwt";

// Rotas abertas: a landing e o login. Todo o resto exige sessão.
const PUBLIC_PATHS = ["/", "/login", "/convite"];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!session && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/inicio";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();

  // Área logada nunca fica em cache. Sem isto, depois de sair a pessoa
  // reaproveita a página anterior no Recarregar ou no botão Voltar (o
  // bfcache do Chrome) e parece que ainda está dentro da conta.
  if (!isPublic) {
    response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  }

  return response;
}

export const config = {
  // /api fica de fora: cada rota valida a sessão e responde 401, sem redirect.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|mp3)$).*)"],
};
