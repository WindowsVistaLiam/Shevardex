require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// ── Chargement des commandes ───────────────────────────────────────────────
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const cmd = require(path.join(commandsPath, file));
  client.commands.set(cmd.data.name, cmd);
}

// ── Table de routage : préfixe customId → commande ────────────────────────
// Chaque commande déclare `handles: ['monprefixe']` pour les boutons/selects/modaux
const handlerMap = new Map();
for (const [, cmd] of client.commands) {
  for (const prefix of (cmd.handles ?? [])) {
    handlerMap.set(prefix, cmd);
  }
}

// ── Événements ────────────────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`✦ ${client.user.tag} est en ligne !`);
  console.log(`  ${client.commands.size} commandes chargées.`);
});

client.on('interactionCreate', async interaction => {
  try {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (cmd) await cmd.execute(interaction);
      return;
    }

    // Boutons, select menus, modaux → routage par préfixe
    if (!interaction.customId) return;
    const prefix  = interaction.customId.split(':')[0];
    const handler = handlerMap.get(prefix);
    if (!handler) return;

    if (interaction.isButton()           && handler.handleButton) await handler.handleButton(interaction);
    if (interaction.isStringSelectMenu() && handler.handleSelect) await handler.handleSelect(interaction);
    if (interaction.isModalSubmit()      && handler.handleModal)  await handler.handleModal(interaction);

  } catch (err) {
    console.error('[bot] Erreur interaction :', err);
    const msg = { content: '❌ Une erreur est survenue.', ephemeral: true };
    try {
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
      else if (interaction.isRepliable())              await interaction.reply(msg);
    } catch (_) {}
  }
});

client.login(process.env.DISCORD_TOKEN);
