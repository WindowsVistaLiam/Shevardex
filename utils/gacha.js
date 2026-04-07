/**
 * Tirage pondéré générique.
 */
function weightedRandom(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Effectue `count` tirages depuis cardsData (cards.json).
 *
 * Algorithme :
 *  1. Tirage de la rareté selon les `chance` définis dans cards.json
 *  2. Tirage uniforme parmi les cartes de cette rareté
 *     — sauf si un wish est actif : la carte wishée a `wishBoost` fois plus de poids
 *
 * @param {object} cardsData   Contenu parsé de cards.json
 * @param {number} count       Nombre de cartes à tirer
 * @param {string|null} wishCardId  ID de la carte boostée (ou null)
 * @param {number} wishBoost   Multiplicateur du wish (défaut 5)
 * @returns {Array} Tableau de cartes obtenues
 */
function rollCards(cardsData, count, wishCardId = null, wishBoost = 5) {
  const { cards, rarities } = cardsData;

  // Regrouper les cartes par rareté (on n'inclut que les raretés non vides)
  const byRarity = {};
  for (const card of cards) {
    if (!byRarity[card.rarity]) byRarity[card.rarity] = [];
    byRarity[card.rarity].push(card);
  }

  const rarityKeys    = Object.keys(rarities).filter(k => byRarity[k]?.length > 0);
  const rarityWeights = rarityKeys.map(k => rarities[k].chance);

  const results = [];
  for (let i = 0; i < count; i++) {
    // 1. Tirage de la rareté
    const rarity = weightedRandom(rarityKeys, rarityWeights);
    const pool   = byRarity[rarity] ?? [];
    if (!pool.length) { i--; continue; }

    // 2. Tirage de la carte
    let card;
    if (wishCardId && pool.some(c => c.id === wishCardId)) {
      const weights = pool.map(c => c.id === wishCardId ? wishBoost : 1);
      card = weightedRandom(pool, weights);
    } else {
      card = pool[Math.floor(Math.random() * pool.length)];
    }
    results.push(card);
  }

  return results;
}

module.exports = { rollCards };
