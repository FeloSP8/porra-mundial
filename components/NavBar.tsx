"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/predicciones", label: "Mis pronósticos" },
  { href: "/grupos", label: "Grupos" },
  { href: "/cuadro", label: "Cuadro" },
  { href: "/jornadas", label: "Jornadas" },
  { href: "/clasificacion", label: "Clasificación" },
  { href: "/estadisticas", label: "Estadísticas" },
  { href: "/reglas", label: "Reglas" },
];

export default function NavBar({
  displayName,
  isAdmin,
}: {
  displayName: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b bg-pitch text-white">
      <nav className="mx-auto flex max-w-4xl flex-col gap-y-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-y-0">
        <div className="flex items-center justify-between w-full sm:w-auto">
          <span className="font-bold whitespace-nowrap">⚽ Porra Mundial 2026</span>
          <div className="flex items-center gap-2 text-sm sm:hidden">
            <span className="opacity-75 text-xs max-w-[120px] truncate">{displayName}</span>
            <button
              onClick={logout}
              className="rounded bg-white/15 px-2 py-1 text-xs transition hover:bg-white/25"
            >
              Salir
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none sm:mx-0 sm:overflow-visible sm:pb-0 sm:px-0">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded px-2.5 py-1 text-sm transition hover:bg-white/15 whitespace-nowrap ${
                  active ? "bg-white/20 font-semibold" : ""
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              className={`rounded px-2.5 py-1 text-sm transition hover:bg-white/15 whitespace-nowrap ${
                pathname.startsWith("/admin") ? "bg-white/20 font-semibold" : ""
              }`}
            >
              Admin
            </Link>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-3 text-sm">
          <span className="opacity-90">{displayName}</span>
          <button
            onClick={logout}
            className="rounded bg-white/15 px-2 py-1 transition hover:bg-white/25"
          >
            Salir
          </button>
        </div>
      </nav>
    </header>
  );
}
