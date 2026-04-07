const { SlashCommandBuilder } = require('discord.js');
const { addPulls, getConfig } = require('../utils/player');
const db = require('../database');

function isStaff(member) {
  if (member.permissions.has('ManageGuild')) return true;
  const roleId = db.prepare("SELECT value FROM config WHERE key='staff_role_id'").get()?.value;
  return roleId && member.roles.cache.has(roleId);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-pull')
    .setDescription('[Staff] Donne des invocations à un joueur')
    .addUserOption(o => o.setName('joueur').setDescription('Joueur cible').setRequired(true))
    .addIntegerOption(o => o.setName('quantite').setDescription('Nombre de pulls').setRequired(true).setMinValue(1).setMaxValue(200)),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: '❌ Permission refusée.', ephemeral: true });
    }
    const target = interaction.options.getUser('joueur');
    const amount = interaction.options.getInteger('quantite');
    const total  = addPulls(target.id, amount);
    await interaction.reply({
      content: `✅ **${amount}** pull(s) ajouté(s) à ${target}. Il/Elle a maintenant **${total}** pull(s).`,
    });
  },
};
