const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { readCards } = require('../utils/cards');
const { rollCards } = require('../utils/gacha');
const { getCurrentPulls, usePulls, getNextPullIn, formatDuration } = require('../utils/player');
const { rarityInfo } = require('../utils/embeds');
const db = require('../database');

// 🔒 anti double multi
const activePulls = new Map();

/**
 * 🌐 URL image carte
 */
function getImageUrl(card) {
  if (!card?.image) return null;

  if (card.image.startsWith('http')) return card.image;

  const baseUrl = 'https://shevardex.zalax.xyz';

  return `${baseUrl}${card.image.startsWith('/') ? '' : '/'}${card.image}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('multi')
    .setDescription('Lance toutes vos invocations disponibles (max 10)'),

  async execute(interaction) {
    const userId = interaction.user.id;

    // 🔒 anti spam / double execution
    if (activePulls.has(userId)) {
      return interaction.reply({
        content: "⏳ Tirage déjà en cours.",
        ephemeral: true,
      });
    }

    activePulls.set(userId, true);

    try {
      const maxPulls = 10;
      const availablePulls = getCurrentPulls(userId);
      const pulls = Math.min(availablePulls, maxPulls);

      if (pulls <= 0) {
        const secs = getNextPullIn(userId);

        return interaction.reply({
          content: `❌ Aucun tirage disponible. Prochain dans **${formatDuration(secs)}**.`,
          ephemeral: true,
        });
      }

      // 🔥 consommation pulls
      const used = usePulls(userId, pulls);

      const cardsData = readCards();

      const wish = db.prepare('SELECT card_id FROM wishes WHERE user_id = ?').get(userId);
      const wishId = wish?.card_id ?? null;

      const wishBoost =
        parseInt(db.prepare("SELECT value FROM config WHERE key='wish_boost'").get()?.value) || 5;

      const results = rollCards(cardsData, used, wishId, wishBoost);

      // 🧹 delete wish
      if (wishId) {
        db.prepare('DELETE FROM wishes WHERE user_id = ?').run(userId);
      }

      // 💾 save collection
      const insertStmt = db.prepare('INSERT INTO collection (user_id, card_id) VALUES (?, ?)');
      for (const card of results) insertStmt.run(userId, card.id);

      // 🔥 tri rareté
      results.sort((a, b) =>
        rarityInfo(b.rarity).order - rarityInfo(a.rarity).order
      );

      // =========================
      // 📦 PAGINATION
      // =========================
      let page = 0;

      const buildEmbed = (i) => {
        const card = results[i];
        const r = rarityInfo(card.rarity);

        return new EmbedBuilder()
          .setColor(r.color)
          .setTitle(card.name)
          .setDescription(`${r.emoji} **${r.label}**`)
          .setImage(getImageUrl(card))
          .setFooter({ text: `Pull ${i + 1}/${results.length}` });
      };

      const buildButtons = (i) => new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('multi_prev')
          .setLabel('⬅️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(i === 0),

        new ButtonBuilder()
          .setCustomId('multi_next')
          .setLabel('➡️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(i === results.length - 1),
      );

      const msg = await interaction.reply({
        embeds: [buildEmbed(page)],
        components: [buildButtons(page)]
      });

      const collector = msg.createMessageComponentCollector({
        time: 120000
      });

      collector.on('collect', async (i) => {
        if (i.user.id !== userId) {
          return i.reply({
            content: "❌ Pas ton tirage.",
            ephemeral: true
          });
        }

        if (i.customId === 'multi_next') page++;
        if (i.customId === 'multi_prev') page--;

        await i.update({
          embeds: [buildEmbed(page)],
          components: [buildButtons(page)]
        });
      });

    } catch (err) {
      console.error('[multi] Erreur:', err);
      return interaction.reply({
        content: "❌ Une erreur est survenue pendant le tirage.",
        ephemeral: true,
      });
    } finally {
      activePulls.delete(userId);
    }
  },
};