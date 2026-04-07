const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { readCards }    = require('../utils/cards');
const { searchCards }  = require('../utils/search');
const { rarityInfo, cardEmbed } = require('../utils/embeds');
const db               = require('../database');

async function showCard(interaction, card, isUpdate = false) {
  const owners = db.prepare('SELECT COUNT(DISTINCT user_id) as n FROM collection WHERE card_id = ?').get(card.id)?.n ?? 0;
  const copies = db.prepare('SELECT COUNT(*) as n FROM collection WHERE card_id = ?').get(card.id)?.n ?? 0;
  const embed  = cardEmbed(card).addFields(
    { name: '👥 Propriétaires',  value: `${owners}`, inline: true },
    { name: '📦 Exemplaires total', value: `${copies}`, inline: true },
  );
  const payload = { embeds: [embed], components: [] };
  if (isUpdate) await interaction.update(payload);
  else          await interaction.reply(payload);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('Affiche les détails d\'un personnage')
    .addStringOption(o => o.setName('personnage').setDescription('Nom (partiel) du personnage').setRequired(true)),

  async execute(interaction) {
    const { cards } = readCards();
    const results   = searchCards(cards, interaction.options.getString('personnage'));

    if (!results.length) return interaction.reply({ content: '❌ Aucun personnage trouvé.', ephemeral: true });
    if (results.length === 1) return showCard(interaction, results[0]);

    const options = results.slice(0, 25).map(c => ({
      label: c.name.slice(0, 100),
      description: rarityInfo(c.rarity).label,
      value: c.id,
    }));
    await interaction.reply({
      content: `🔍 Plusieurs résultats — lequel ?`,
      components: [new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('info:select').setPlaceholder('Choisir…').addOptions(options)
      )],
      ephemeral: true,
    });
  },

  handles: ['info'],

  async handleSelect(interaction) {
    const { cards } = readCards();
    const card = cards.find(c => c.id === interaction.values[0]);
    if (!card) return interaction.update({ content: '❌ Carte introuvable.', components: [] });
    await showCard(interaction, card, true);
  },
};
