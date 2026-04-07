const fs   = require('fs');
const path = require('path');

const CARDS_PATH = process.env.CARDS_PATH
  ? path.resolve(process.env.CARDS_PATH)
  : path.join(__dirname, '..', '..', 'cards.json');

function readCards() {
  return JSON.parse(fs.readFileSync(CARDS_PATH, 'utf8'));
}

module.exports = { readCards };
