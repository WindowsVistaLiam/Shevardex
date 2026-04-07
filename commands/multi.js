const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readCards }  = require('../utils/cards');
const { rollCards }  = require('../utils/gacha');
const { getCurrentPulls, usePulls, getNextPullIn, formatDuration } = require('../utils/player');
const { rarityInfo } = require('../utils/embeds');
const db             = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('multi')
    .setDescription('Lance toutes vos invocations disponibles'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const pulls  = getCurrentPulls(userId);

    if (pulls === 0) {
      const secs = getNextPullIn(userId);
      return interaction.reply({
        content: `❌ Aucune invocation disponible. Prochain pull dans **${formatDuration(secs)}**.`,
        ephemeral: true,
      });
    }

    const used      = usePulls(userId, pulls);
    const cardsData = readCards();
    const wish      = db.prepare('SELECT card_id FROM wishes WHERE user_id = ?').get(userId);
    const wishId    = wish?.card_id ?? null;
    const wishBoost = parseInt(db.prepare("SELECT value FROM config WHERE key='wish_boost'").get()?.value) || 5;

    const results = rollCards(cardsData, used, wishId, wishBoost);
    if (wishId) db.prepare('DELETE FROM wishes WHERE user_id = ?').run(userId);

    const insertStmt = db.prepare('INSERT INTO collection (user_id, card_id) VALUES (?, ?)');
    for (const card of results) insertStmt.run(userId, card.id);

    results.sort((a, b) => rarityInfo(b.rarity).order - rarityInfo(a.rarity).order);

    const lines = results.map(card => {
      const r = rarityInfo(card.rarity);
      return `${r.emoji} **${card.name}** — *${r.label}*${wishId === card.id ? ' 💫 **WISH !**' : ''}`;
    });

    const remaining = getCurrentPulls(userId);
    const nextSecs  = getNextPullIn(userId);
    const footer    = remaining === 0
      ? `0 pull restant — prochain dans ${formatDuration(nextSecs)}`
      : `${remaining} pull(s) restant(s)${nextSecs ? ` — prochain dans ${formatDuration(nextSecs)}` : ''}`;

    const embed = new EmbedBuilder()
      .setColor(rarityInfo(results[0]?.rarity).color)
      .setTitle(`✦ ${used} Invocation${used > 1 ? 's' : ''} de ${interaction.user.displayName}`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: footer })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
