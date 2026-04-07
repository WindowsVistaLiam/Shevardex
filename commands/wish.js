const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { readCards }   = require('../utils/cards');
const { searchCards } = require('../utils/search');
const { rarityInfo }  = require('../utils/embeds');
const db              = require('../database');

async function applyWish(interaction, card, isUpdate = false) {
  const boost = parseInt(db.prepare("SELECT value FROM config WHERE key='wish_boost'").get()?.value) || 5;
  db.prepare('INSERT OR REPLACE INTO wishes (user_id, card_id) VALUES (?, ?)').run(interaction.user.id, card.id);
  const r = rarityInfo(card.rarity);
  const embed = new EmbedBuilder()
    .setColor(r.color)
    .setTitle('💫 Wish activé !')
    .setDescription(`Votre prochain **/multi** aura **${boost}×** plus de chances d'obtenir **${card.name}**.`)
    .addFields({ name: 'Rareté', value: `${r.emoji} ${r.label}`, inline: true })
    .setFooter({ text: 'Consommé au prochain /multi, même si la carte n\'est pas obtenue.' });
  const payload = { embeds: [embed], components: [], ephemeral: true };
  if (isUpdate) await interaction.update(payload);
  else          await interaction.reply(payload);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wish')
    .setDescription('Booste le drop d\'un personnage pour votre prochain /multi (one-shot)')
    .addStringOption(o => o.setName('personnage').setDescription('Nom (partiel) du personnage').setRequired(true)),

  async execute(interaction) {
    const { cards } = readCards();
    const results   = searchCards(cards, interaction.options.getString('personnage'));

    if (!results.length) {
      return interaction.reply({ content: `❌ Aucun personnage trouvé.`, ephemeral: true });
    }
    if (results.length === 1) return applyWish(interaction, results[0]);

    const options = results.slice(0, 25).map(c => ({
      label: c.name.slice(0, 100),
      description: rarityInfo(c.rarity).label,
      value: c.id,
    }));
    await interaction.reply({
      content: `🔍 Plusieurs résultats — lequel ?`,
      components: [new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('wish:select').setPlaceholder('Choisir…').addOptions(options)
      )],
      ephemeral: true,
    });
  },

  handles: ['wish'],

  async handleSelect(interaction) {
    const { cards } = readCards();
    const card = cards.find(c => c.id === interaction.values[0]);
    if (!card) return interaction.update({ content: '❌ Carte introuvable.', components: [] });
    await applyWish(interaction, card, true);
  },
};
