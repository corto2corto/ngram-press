// Logo du site : spirale d'or esquissée — arcs de Fibonacci en quarts de cercle
// et quelques traits de construction qui débordent, comme sur un croquis.
// `trait` permet d'affiner le dessin quand on l'affiche en grand (le trait
// n'est pas mis à l'échelle : une spirale de 280 px veut un trait plus fin
// qu'une spirale de 30 px, sinon elle s'empâte).
// `pathLength={1}` normalise la longueur des tracés : le dessin animé de
// l'en-tête (globals.css, A1) peut ainsi durer le même temps à toute taille.
export default function Spirale({
  taille = 30,
  trait = 9.5,
  construction = true,
}: {
  taille?: number;
  trait?: number;
  construction?: boolean;
}) {
  return (
    <svg
      width={taille}
      height={Math.round(taille * (110 / 125))}
      viewBox="0 0 125 110"
      fill="none"
      aria-hidden="true"
    >
      {construction && (
        <g
          stroke="currentColor"
          strokeWidth={trait * 0.37}
          strokeLinecap="round"
          opacity={0.4}
        >
          <line pathLength={1} x1="22" y1="65" x2="121" y2="65" />
          <line pathLength={1} x1="60" y1="12" x2="60" y2="86" />
          <line pathLength={1} x1="42" y1="99" x2="104" y2="99" />
        </g>
      )}
      <path
        pathLength={1}
        d="M60 10 A55 55 0 0 1 115 65 A34 34 0 0 1 81 99 A21 21 0 0 1 60 78 A13 13 0 0 1 73 65 A8 8 0 0 1 81 73 A5 5 0 0 1 76 78 A3 3 0 0 1 73 75"
        stroke="currentColor"
        strokeWidth={trait}
        strokeLinecap="round"
      />
    </svg>
  );
}
