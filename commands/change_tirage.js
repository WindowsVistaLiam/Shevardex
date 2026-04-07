const { SlashCommandBuilder } = require('discord.js');
const db = require('../database');

function isStaff(member) {
  if (member.permissions.has('ManageGuild')) return true;
  const roleId = db.prepare("SELECT value FROM config WHERE key='staff_role_id'").get()?.value;
  return roleId && member.roles.cache.has(roleId);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('change-tirage')
    .setDescription('[Staff] Modifie les paramètres du système d\'invocations')
    .addSubcommand(s => s
      .setName('voir')
      .setDescription('Affiche la configuration actuelle'))
    .addSubcommand(s => s
      .setName('recharge')
      .setDescription('Pulls regagnés par heure (défaut : 1)')
      .addIntegerOption(o => o.setName('valeur').setDescription('Ex: 1').setRequired(true).setMinValue(1).setMaxValue(10)))
    .addSubcommand(s => s
      .setName('max-pulls')
      .setDescription('Maximum de pulls stockables (défaut : 10)')
      .addIntegerOption(o => o.setName('valeur').setDescription('Ex: 10').setRequired(true).setMinValue(1).setMaxValue(100)))
    .addSubcommand(s => s
      .setName('wish-boost')
      .setDescription('Multiplicateur du wish (défaut : 5)')
      .addIntegerOption(o => o.setName('valeur').setDescription('Ex: 5').setRequired(true).setMinValue(2).setMaxValue(50)))
    .addSubcommand(s => s
      .setName('role-staff')
      .setDescription('Définit le rôle autorisé à utiliser les commandes staff')
      .addRoleOption(o => o.setName('role').setDescription('Rôle staff').setRequired(true))),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: '❌ Permission refusée.', ephemeral: true });
    }
    const sub = interaction.options.getSubcommand();

    if (sub === 'voir') {
      const get = key => db.prepare('SELECT value FROM config WHERE key = ?').get(key)?.value ?? '?';
      const roleId = get('staff_role_id');
      return interaction.reply({
        content: [
          '⚙️ **Configuration du système d\'invocations**',
          `• Pulls/heure : **${get('pulls_per_hour')}**`,
          `• Max pulls stockables : **${get('max_pulls')}**`,
          `• Multiplicateur wish : **${get('wish_boost')}×**`,
          `• Rôle staff : ${roleId ? `<@&${roleId}>` : '*non défini*'}`,
        ].join('\n'),
        ephemeral: true,
      });
    }

    if (sub === 'role-staff') {
      const role = interaction.options.getRole('role');
      db.prepare("UPDATE config SET value = ? WHERE key = 'staff_role_id'").run(role.id);
      return interaction.reply({ content: `✅ Rôle staff mis à jour → ${role}.`, ephemeral: true });
    }

    const keyMap = { recharge: 'pulls_per_hour', 'max-pulls': 'max_pulls', 'wish-boost': 'wish_boost' };
    const key    = keyMap[sub];
    const value  = interaction.options.getInteger('valeur');
    db.prepare('UPDATE config SET value = ? WHERE key = ?').run(value.toString(), key);
    await interaction.reply({ content: `✅ **${sub}** → **${value}**`, ephemeral: true });
  },
};
