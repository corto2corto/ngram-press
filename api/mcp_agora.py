# Serveur MCP d'Agora : expose l'API en outils appelables par un LLM (Claude,
# ChatGPT...). Même montage que gallicagram.com : processus séparé sur un port
# local, exposé au monde par le proxy /mcp de api/app_agora.py.
# Les outils appellent l'API Flask locale (port 8010) plutôt que les bases :
# une seule source de vérité pour la tokenisation, les dates et les corpus.
# Lancement (serveur) : venv_agora/bin/python -m api.mcp_agora
# Test local : AGORA_API=http://localhost:8502 python -m api.mcp_agora

import io
import os

import pandas as pd
import requests

from mcp.server.mcpserver import MCPServer

API = os.environ.get("AGORA_API", "http://127.0.0.1:8010")
MAX_LIGNES = 1000

mcp = MCPServer(
    "Agora MCP",
    instructions=(
        "Agora mesure la fréquence des mots dans la presse numérique française "
        "contemporaine (Le Monde, Le Parisien, Mediapart, Les Échos...). "
        "Appelle d'abord list_corpora pour connaître les corpus valides et "
        "leurs périodes, puis query_frequency pour obtenir les séries, ou "
        "compare_usage pour classer les médias selon l'usage relatif de deux mots."
    ),
)


@mcp.tool()
def list_corpora() -> list:
    """Liste les corpus de presse interrogeables, avec leur période couverte.

    ### Quand utiliser cet outil :
    - Toujours en premier, avant `query_frequency` : les identifiants de corpus
      sont normalisés (ex: `le_monde` et non `lemonde`) et cette liste est la
      seule source fiable.
    - Pour vérifier qu'une période demandée est bien couverte par le corpus.

    ### Ce que renvoie l'outil :
    Une liste d'objets `{corpus, debut, fin, avec_2gram}` :
    - `corpus` : identifiant exact à passer à `query_frequency`.
    - `debut` / `fin` : premières et dernières dates disponibles (AAAA-MM-JJ).
    - `avec_2gram` : si vrai, le corpus accepte les syntagmes de 2 mots
      (ex: "pouvoir d'achat" -> "pouvoir achat" après tokenisation) ;
      sinon, un seul mot par expression.
    """
    reponse = requests.get(f"{API}/catalogue", timeout=30)
    reponse.raise_for_status()
    return reponse.json()


@mcp.tool()
def query_frequency(mot: str, corpus: str, debut: str = "1900",
                    fin: str = "2100", resolution: str = "mois") -> dict:
    """Mesure l'évolution de la fréquence d'un ou plusieurs mots dans un corpus
    de presse française contemporaine.

    ### Syntaxe du paramètre `mot` :
    - Un mot simple (`inflation`) ou un syntagme de 2 mots (`crise financière`),
      si le corpus dispose de bigrammes (voir `avec_2gram` dans `list_corpora`).
    - Plusieurs expressions séparées par des virgules pour comparer des séries
      (`inflation,chômage,pouvoir achat`), 5 au maximum.
    - Les expressions sont tokenisées (minuscules, ponctuation retirée) ; un mot
      absent du corpus renvoie une série à zéro, pas une erreur.

    ### Paramètres temporels :
    - `debut` / `fin` : bornes incluses, au format AAAA, AAAA-MM ou AAAA-MM-JJ.
    - `resolution` : `jour`, `mois` ou `annee`. La réponse est plafonnée à 1000
      lignes : sur une longue période, préférer `annee` ou `mois`.

    ### Ce que renvoie l'outil :
    `{lignes: [...], nb_lignes}` où chaque ligne contient `gram` (l'expression),
    les colonnes de date (`annee`, puis `mois` et `jour` selon la résolution),
    `n` (occurrences brutes), `total` (taille du corpus sur la période) et
    `freq` (fréquence relative n/total, à utiliser pour comparer dans le temps
    ou entre corpus). En cas de paramètre invalide, `{erreur}` détaille le
    problème et les choix valides.
    """
    if mot.count(",") >= 5:
        return {"erreur": "5 expressions au maximum par appel"}
    reponse = requests.get(f"{API}/query", timeout=60, params={
        "mot": mot, "corpus": corpus, "from": debut, "to": fin,
        "resolution": resolution})
    if reponse.status_code != 200:
        return {"erreur": reponse.text}
    df = pd.read_csv(io.StringIO(reponse.text))
    if len(df) > MAX_LIGNES:
        return {"erreur": f"série trop longue ({len(df)} lignes, maximum "
                          f"{MAX_LIGNES}) : réduire la période ou passer à une "
                          "résolution plus grossière (mois, annee)"}
    df["freq"] = (df["n"] / df["total"].where(df["total"] > 0)).fillna(0)
    df["freq"] = df["freq"].map(lambda f: float(f"{f:.4g}"))
    return {"lignes": df.to_dict("records"), "nb_lignes": len(df)}


@mcp.tool()
def compare_usage(mot_a: str, mot_b: str, debut: str = "1900", fin: str = "2100",
                  corpus: str = "") -> dict:
    """Compare l'usage relatif de deux expressions d'un média à l'autre : pour
    chaque corpus, le rapport fréquence de A / fréquence de B sur la période.

    ### Quand utiliser cet outil :
    - Pour savoir quels médias emploient davantage un mot qu'un autre
      (ex. « gaza » contre « ukraine », « entrecôte » contre « tofu »), et
      classer les médias selon ce rapport.
    - Pour un seul média dans le temps, préférer `query_frequency`.

    ### Paramètres :
    - `mot_a`, `mot_b` : une expression chacun (1 ou 2 mots, tokenisée comme
      dans `query_frequency`).
    - `debut` / `fin` : bornes incluses, au format AAAA, AAAA-MM ou AAAA-MM-JJ.
    - `corpus` : identifiants séparés par des virgules (voir `list_corpora`) ;
      vide = tous les corpus.

    ### Ce que renvoie l'outil :
    `{mot_a, mot_b, de, a, corpus: [...]}` avec, par corpus : `n_a`, `n_b`
    (occurrences sur la période), `total_a`, `total_b` (mots du corpus sur la
    période), `freq_a`, `freq_b` (fréquences relatives) et `ratio`
    (`freq_a / freq_b`). Le rapport vaut 0 si A est absente, null si B l'est
    ou si le corpus n'a aucun article sur la période. Les corpus sont triés
    par rapport décroissant, les null en dernier. En cas de paramètre
    invalide, `{erreur}` détaille le problème.
    """
    params = {"mot": f"{mot_a},{mot_b}", "from": debut, "to": fin}
    if corpus:
        params["corpus"] = corpus
    reponse = requests.get(f"{API}/ratio", timeout=120, params=params)
    if reponse.status_code != 200:
        return {"erreur": reponse.text}
    return reponse.json()


if __name__ == "__main__":
    # stateless + json_response : pas de session à maintenir, réponses JSON
    # simples qui traversent le proxy Flask sans buffering SSE
    mcp.run(transport="streamable-http", host="127.0.0.1",
            port=int(os.environ.get("AGORA_MCP_PORT", "8011")),
            stateless_http=True, json_response=True)
