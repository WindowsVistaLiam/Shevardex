const { EmbedBuilder } = require('discord.js');

const RARITY = {
  onirique:   { emoji: '🌸', color: 0xf48fb1, label: 'Onirique',   order: 5 },
  legendaire: { emoji: '✨', color: 0xffd54f, label: 'Légendaire', order: 4 },
  epique:     { emoji: '💜', color: 0xce93d8, label: 'Épique',     order: 3 },
  rare:       { emoji: '💙', color: 0x4fc3f7, label: 'Rare',       order: 2 },
  commun:     { emoji: '🩶', color: 0xa0a0b0, label: 'Commun',     order: 1 },
};

function rarityInfo(key) {
  return RARITY[key] ?? { emoji: '❓', color: 0x888888, label: key ?? '?', order: 0 };
}

/**
 * Embed détaillé pour une carte (utilisé par /info).
 */
function cardEmbed(card) {
  const r = rarityInfo(card.rarity);
  const embed = new EmbedBuilder()
    .setColor(r.color)
    .setTitle(`${r.emoji} ${card.name}`)
    .setDescription(card.description || '*Aucune description.*')
    .addFields({ name: 'Rareté', value: r.label, inline: true });
  if (card.image) embed.setImage('https://shevardex.zalax.xyz' + card.image);
  if (card.owner) embed.setFooter({ text: `Personnage de ${card.owner}` });
  return embed;
}

module.exports = { RARITY, rarityInfo, cardEmbed };
