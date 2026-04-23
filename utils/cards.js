const fs = require('fs');
const path = require('path');

const CARDS_PATH = process.env.CARDS_PATH
  ? path.resolve(process.env.CARDS_PATH)
  : path.resolve(process.cwd(), 'cards.json');

function readCards() {
  console.log('[cards.js] Chargement depuis :', CARDS_PATH);

  if (!fs.existsSync(CARDS_PATH)) {
    throw new Error(`[cards.js] cards.json introuvable : ${CARDS_PATH}`);
  }

  return JSON.parse(fs.readFileSync(CARDS_PATH, 'utf8'));
}

module.exports = { readCards };