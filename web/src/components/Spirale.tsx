// Logo du site : spirale d'or esquissée — arcs de Fibonacci en quarts de cercle
// et quelques traits de construction qui débordent, comme sur un croquis.
// Le dessin est simplifié pour rester lisible en petit corps (en-tête).
export default function Spirale({ taille = 30 }: { taille?: number }) {
  return (
    <svg
      width={taille}
      height={Math.round(taille * (110 / 125))}
      viewBox="0 0 125 110"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" opacity={0.4}>
        <line x1="22" y1="65" x2="121" y2="65" />
        <line x1="60" y1="12" x2="60" y2="86" />
        <line x1="42" y1="99" x2="104" y2="99" />
      </g>
      <path
        d="M60 10 A55 55 0 0 1 115 65 A34 34 0 0 1 81 99 A21 21 0 0 1 60 78 A13 13 0 0 1 73 65 A8 8 0 0 1 81 73 A5 5 0 0 1 76 78 A3 3 0 0 1 73 75"
        stroke="currentColor"
        strokeWidth={9.5}
        strokeLinecap="round"
      />
    </svg>
  );
}
