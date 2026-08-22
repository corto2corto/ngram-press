"use client";

// Vue tableau : les mêmes valeurs que le graphe, accessibles sans survol.

import type { Serie } from "@/lib/api";
import { formaterValeur, valeurPoint, type Metrique } from "@/lib/mesures";
import { localeDe, textes, type Lang } from "@/lib/i18n";

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

  return (
    <div className="defilement">
      <table>
        <thead>
          <tr>
            <th scope="col">{t.col_periode}</th>
            {series.map((s) => (
              <th scope="col" key={s.gram}>
                {s.gram}
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
                  <td key={s.gram}>
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
