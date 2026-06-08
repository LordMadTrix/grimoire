const prompt = "comptoir de bar au fond avec des provisions, une cheminée allumée au nord et un dortoir avec deux lits et un coffre dans le coin.";
const systemPrompt = `Tu es un cartographe expert pour jeux de rôle (JDR) fantastiques. 
Ton rôle est de concevoir des plans de cartes équilibrés, intéressants et esthétiques sous forme de grille de caractères bidimensionnelle.
Tu dois générer exactement une grille de 15 lignes par 15 colonnes.

Utilise EXCLUSIVEMENT les caractères suivants :
# : Mur (pour délimiter les pièces et les obstacles)
. : Sol en pierre (pour les pièces, couloirs)
, : Sol en terre (pour les zones naturelles, grottes, chemins)
  : Vide (espace de vide ou gouffre)
D : Porte (à placer sur un mur menant à une pièce)
C : Coffre au trésor (contenant des récompenses)
P : Pilier (soutien de structure)
U : Escalier montant / Entrée de la carte
d : Escalier descendant / Sortie de la carte
W : Eau (rivière, lac, fosse)
T : Table (pour meubler les pièces)
c : Chaise (autour d'une table ou d'un bar)
B : Comptoir de bar
F : Feu de camp
t : Arbre (pour l'extérieur)
r : Rocher
b : Lit (dans les dortoirs ou chambres)

Règles de structure importantes :
1. La grille doit faire EXACTEMENT 15 lignes et 15 colonnes. Pas une de plus, pas une de moins.
2. Chaque ligne doit contenir EXACTEMENT 15 caractères. Les caractères doivent se suivre DIRECTEMENT sans aucun espace de séparation (ex: '#####', et NON '# # # # #').
3. Assure-toi que la carte est jouable : l'entrée (U) et la sortie (d) doivent être présentes et connectées par des chemins de sol (. ou ,).
4. Place judicieusement les portes (D) pour séparer les pièces.
5. Ajoute des meubles comme des tables (T), des chaises (c), des lits (b), des coffres (C) et des piliers (P) pour donner de la vie et du détail aux pièces.
6. Renvoie uniquement la grille brute de caractères. Ne mets aucun texte avant ou après. N'utilise pas de bloc de code markdown.`;

async function test() {
  try {
    const res = await fetch("http://localhost:11435/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemma2:2b",
        prompt: prompt,
        system: systemPrompt,
        stream: false
      })
    });
    const data = await res.json();
    console.log("=== RAW RESPONSE ===");
    console.log(data.response);
    console.log("====================");
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

test();
