"use client";

// Vue tableau : les mêmes valeurs que le graphe, accessibles sans survol.

import type { Serie } from "@/lib/api";
import { formaterValeur, valeurPoint, type Metrique } from "@/lib/mesures";
import { corpusNoms, localeDe, textes, type Lang } from "@/lib/i18n";

export default function DataTable({
  series,
  lang,
  metrique,
}: {
  series: Serie[];
  lang: Lang;
  metrique: Metrique;
}) {
  const t = textes[lang];
  const locale = localeDe(lang);
  // plusieurs médias comparés : la colonne dit le mot et le média
  const multi = new Set(series.map((s) => s.corpus)).size > 1;
  const cle = (s: (typeof series)[number]) => `${s.corpus ?? ""}-${s.gram}`;
  const entete = (s: (typeof series)[number]) =>
    multi && s.corpus ? `${s.gram} · ${corpusNoms[s.corpus] ?? s.corpus}` : s.gram;

  return (
    <div className="defilement">
      <table>
        <thead>
          <tr>
            <th scope="col">{t.col_periode}</th>
            {series.map((s) => (
              <th scope="col" key={cle(s)}>
                {entete(s)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {series[0]?.points.map((p, i) => (
            <tr key={p.etiquette}>
              <td>{p.etiquette}</td>
              {series.map((s) => {
                const q = s.points[i];
                return (
                  <td key={cle(s)}>
                    {q ? formaterValeur(valeurPoint(q, metrique), metrique, locale) : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
