"use client";

import { useState } from "react";

/**
 * Portada de ganador: se muestra cuando el torneo ha terminado. Intenta cargar
 * /ganadores/<slug>.jpg y, si no existe, prueba .png; si tampoco, cae a un
 * banner de texto con el trofeo. Así funciona aunque aún no hayas subido la
 * imagen.
 */
export default function WinnerBanner({
  name,
  slug,
  preview = false,
}: {
  name: string;
  slug: string;
  preview?: boolean;
}) {
  const [ext, setExt] = useState<"jpg" | "png" | null>("jpg");

  return (
    <section className="overflow-hidden rounded-2xl border border-gold bg-gradient-to-b from-yellow-50 to-white text-center shadow-sm">
      {preview && (
        <p className="bg-amber-100 px-4 py-1 text-xs font-medium text-amber-800">
          👁️ Vista previa (solo la ves tú como admin) · busca /ganadores/{slug}
          .jpg o .png
        </p>
      )}
      <div className="px-4 pt-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
          🏆 Ganador de la porra
        </p>
        <h2 className="mt-1 text-3xl font-extrabold text-pitch">{name}</h2>
      </div>

      {ext ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/ganadores/${slug}.${ext}`}
          alt={`Ganador: ${name}`}
          onError={() => setExt(ext === "jpg" ? "png" : null)}
          className="mx-auto mt-4 max-h-[70vh] w-full object-contain"
        />
      ) : (
        <div className="px-4 py-10 text-7xl">🏆🎉</div>
      )}

      <p className="px-4 pb-5 pt-3 text-sm text-slate-600">
        ¡Enhorabuena, <b>{name}</b>! Campeón de la porra del Mundial 2026.
      </p>
    </section>
  );
}
