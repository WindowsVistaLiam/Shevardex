function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function searchCards(cards, query) {
  const q = normalize(query);
  if (!q) return [];
  return cards.filter(c => normalize(c.name).includes(q));
}

function searchInCollection(collectionRows, cards, query) {
  const q = normalize(query);
  if (!q) return [];
  const seen = new Set();
  const results = [];
  for (const row of collectionRows) {
    if (seen.has(row.card_id)) continue;
    const card = cards.find(c => c.id === row.card_id);
    if (!card) continue;
    if (normalize(card.name).includes(q)) {
      seen.add(row.card_id);
      results.push({ ...row, card });
    }
  }
  return results;
}

module.exports = { normalize, searchCards, searchInCollection };
