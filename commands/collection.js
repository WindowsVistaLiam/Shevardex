const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { readCards }  = require('../utils/cards');
const { rarityInfo } = require('../utils/embeds');
const db             = require('../database');

const PAGE_SIZE = 10;

function buildPage(targetId, displayName, page, sort) {
  const rows    = db.prepare('SELECT * FROM collection WHERE user_id = ? ORDER BY obtained_at DESC').all(targetId);
  const cards   = readCards().cards;

  let items = rows.map(r => ({ ...r, card: cards.find(c => c.id === r.card_id) })).filter(i => i.card);

  if (sort === 'alpha')  items.sort((a, b) => a.card.name.localeCompare(b.card.name));
  if (sort === 'rarity') items.sort((a, b) => rarityInfo(b.card.rarity).order - rarityInfo(a.card.rarity).order);
  // sort === 'date' : déjà trié par obtained_at DESC

  const total    = items.length;
  const pages    = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const p        = Math.max(0, Math.min(page, pages - 1));
  const slice    = items.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);

  const lines = slice.map(i => {
    const r    = rarityInfo(i.card.rarity);
    const date = new Date(i.obtained_at * 1000).toLocaleDateString('fr-FR');
    return `${r.emoji} **${i.card.name}** — *${r.label}* · ${date}`;
  });

  const sortLabel = { date: 'Date', alpha: 'A–Z', rarity: 'Rareté' }[sort];
  const embed = new EmbedBuilder()
    .setColor(0xc9a84c)
    .setTitle(`📚 Collection de ${displayName}`)
    .setDescription(total === 0 ? '*Aucune carte pour l\'instant.*' : lines.join('\n'))
    .setFooter({ text: `Page ${p + 1}/${pages} · ${total} carte(s) · Tri : ${sortLabel}` });

  return { embed, page: p, pages, sort, total };
}

function buildRows(targetId, page, pages, sort) {
  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`collection:prev:${targetId}:${page}:${sort}`).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId(`collection:next:${targetId}:${page}:${sort}`).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= pages - 1),
    new ButtonBuilder().setCustomId(`collection:sort:${targetId}:0:date`).setLabel('📅 Date').setStyle(sort === 'date' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`collection:sort:${targetId}:0:alpha`).setLabel('🔤 A–Z').setStyle(sort === 'alpha' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`collection:sort:${targetId}:0:rarity`).setLabel('⭐ Rareté').setStyle(sort === 'rarity' ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );
  return [nav];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('collection')
    .setDescription('Affiche votre collection de cartes')
    .addUserOption(o => o.setName('joueur').setDescription('Voir la collection d\'un autre joueur')),

  async execute(interaction) {
    const target  = interaction.options.getUser('joueur') ?? interaction.user;
    const { embed, page, pages, sort } = buildPage(target.id, target.displayName, 0, 'date');
    const isOwner = target.id === interaction.user.id;
    const rows    = isOwner ? buildRows(target.id, page, pages, sort) : [];
    await interaction.reply({ embeds: [embed], components: rows });
  },

  handles: ['collection'],

  async handleButton(interaction) {
    const [, action, targetId, pageStr, sort] = interaction.customId.split(':');
    if (interaction.user.id !== targetId) {
      return interaction.reply({ content: '❌ Ces boutons ne vous appartiennent pas.', ephemeral: true });
    }
    const cur    = parseInt(pageStr);
    const newPg  = action === 'prev' ? cur - 1 : action === 'next' ? cur + 1 : 0;
    const target = await interaction.client.users.fetch(targetId);
    const { embed, page, pages } = buildPage(targetId, target.displayName, newPg, sort);
    await interaction.update({ embeds: [embed], components: buildRows(targetId, page, pages, sort) });
  },
};
