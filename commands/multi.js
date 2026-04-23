const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { readCards }  = require('../utils/cards');
const { rollCards }  = require('../utils/gacha');
const { getCurrentPulls, usePulls, getNextPullIn, formatDuration } = require('../utils/player');
const { rarityInfo } = require('../utils/embeds');
const db = require('../database');

const activePulls = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('multi')
    .setDescription('Lance toutes vos invocations disponibles'),

  async execute(interaction) {
    const userId = interaction.user.id;

    if (activePulls.has(userId)) {
      return interaction.reply({
        content: "⏳ Tirage déjà en cours.",
        ephemeral: true,
      });
    }

    activePulls.set(userId, true);

    try {
      const pulls = getCurrentPulls(userId);

      if (pulls <= 0) {
        const secs = getNextPullIn(userId);

        return interaction.reply({
          content: `❌ Aucun tirage disponible. Prochain dans **${formatDuration(secs)}**.`,
          ephemeral: true,
        });
      }

      const used = usePulls(userId, pulls);
      const cardsData = readCards();

      const wish = db.prepare('SELECT card_id FROM wishes WHERE user_id = ?').get(userId);
      const wishId = wish?.card_id ?? null;

      const wishBoost =
        parseInt(db.prepare("SELECT value FROM config WHERE key='wish_boost'").get()?.value) || 5;

      const results = rollCards(cardsData, used, wishId, wishBoost);

      if (wishId) {
        db.prepare('DELETE FROM wishes WHERE user_id = ?').run(userId);
      }

      const insertStmt = db.prepare('INSERT INTO collection (user_id, card_id) VALUES (?, ?)');

      for (const card of results) {
        insertStmt.run(userId, card.id);
      }

      results.sort(
        (a, b) => rarityInfo(b.rarity).order - rarityInfo(a.rarity).order
      );

      // 🔥 pages
      let page = 0;

      const buildEmbed = (i) => {
        const card = results[i];
        const r = rarityInfo(card.rarity);

        return new EmbedBuilder()
          .setColor(r.color)
          .setTitle(card.name)
          .setDescription(`${r.emoji} **${r.label}**`)
          .setImage(
            card.image || card.img || card.url || null // 🔥 fallback safe
          )
          .setFooter({ text: `Pull ${i + 1}/${results.length}` });
      };

      const buildButtons = (i) => new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`multi:prev:${userId}`)
          .setLabel('⬅️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(i === 0),

        new ButtonBuilder()
          .setCustomId(`multi:next:${userId}`)
          .setLabel('➡️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(i === results.length - 1),
      );

      const msg = await interaction.reply({
        embeds: [buildEmbed(page)],
        components: [buildButtons(page)],
        fetchReply: true
      });

      const collector = msg.createMessageComponentCollector({
        time: 120000
      });

      collector.on('collect', async (i) => {
        if (i.user.id !== userId) {
          return i.reply({
            content: "❌ Ce tirage ne t'appartient pas.",
            ephemeral: true
          });
        }

        if (i.customId.includes('next')) page++;
        if (i.customId.includes('prev')) page--;

        await i.update({
          embeds: [buildEmbed(page)],
          components: [buildButtons(page)]
        });
      });

    } finally {
      activePulls.delete(userId);
    }
  },
};