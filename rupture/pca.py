# Normalisation et PCA des fenetres de sauts — extrait de stage-mids/rupture/pca.py.
# Copie REDUITE (03/09/2026) : seules normaliser et pca sont reprises, mot pour mot ;
# l'import de rupture.graphes (qui tire matplotlib), nettoyer et le script de
# figures sont retires — le serveur ne trace rien, la route /projection n'a
# besoin que de normaliser(F, "z") pour z-scorer une fenetre comme au fit.
# Le fichier d'origine reste la reference : ne pas modifier ces fonctions ici.
import numpy as np


def normaliser(F, norme):
    """Matrice normalisee + indices des fenetres gardees."""
    F = F.astype(np.float64)
    if norme == "z":
        ecart = F.std(axis=1)
        garde = ecart > 0
        F = F[garde]
        F = (F - F.mean(axis=1, keepdims=True)) / F.std(axis=1, keepdims=True)
    elif norme == "01":
        amplitude = F.max(axis=1) - F.min(axis=1)
        garde = amplitude > 0
        F = F[garde]
        F = (F - F.min(axis=1, keepdims=True)) / (F.max(axis=1, keepdims=True)
                                                  - F.min(axis=1, keepdims=True))
    elif norme == "col":
        garde = np.ones(len(F), bool)
        F = (F - F.mean(axis=0)) / F.std(axis=0)
    else:
        raise ValueError(f"norme inconnue : {norme}")
    return F, np.where(garde)[0]


def pca(F):
    """Centrage colonne + SVD ; renvoie (composantes en lignes, part de
    variance expliquee, projections)."""
    Fc = F - F.mean(axis=0)
    U, S, Vt = np.linalg.svd(Fc, full_matrices=False)
    return Vt, S**2 / (S**2).sum(), U * S
