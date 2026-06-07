"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/predicciones", label: "Mis pronósticos" },
  { href: "/clasificacion", label: "Clasificación" },
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
      <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <span className="mr-2 font-bold">⚽ Porra 2026</span>
        {LINKS.map((l) => {
          const active =
            l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded px-2 py-1 text-sm transition hover:bg-white/15 ${
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
            className={`rounded px-2 py-1 text-sm transition hover:bg-white/15 ${
              pathname.startsWith("/admin") ? "bg-white/20 font-semibold" : ""
            }`}
          >
            Admin
          </Link>
        )}
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden sm:inline opacity-90">{displayName}</span>
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
