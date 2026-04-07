const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { readCards }  = require('../utils/cards');
const { rarityInfo } = require('../utils/embeds');
const db             = require('../database');

const PAGE_SIZE = 10;

function buildPage(page, sort, filter) {
  let { cards } = readCards();
  if (filter !== 'all') cards = cards.filter(c => c.rarity === filter);
  if (sort === 'alpha')  cards = [...cards].sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'rarity') cards = [...cards].sort((a, b) => rarityInfo(b.rarity).order - rarityInfo(a.rarity).order);

  const total = cards.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const p     = Math.max(0, Math.min(page, pages - 1));
  const slice = cards.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
  const cntStmt = db.prepare('SELECT COUNT(DISTINCT user_id) as n FROM collection WHERE card_id = ?');

  const lines = slice.map(card => {
    const r   = rarityInfo(card.rarity);
    const cnt = cntStmt.get(card.id)?.n ?? 0;
    return `${r.emoji} **${card.name}** — *${r.label}* · 👤 ${cnt}`;
  });

  const filterLabel = filter === 'all' ? 'Toutes' : rarityInfo(filter).label;
  const sortLabel   = { alpha: 'A–Z', rarity: 'Rareté', added: 'Ajout' }[sort];
  const embed = new EmbedBuilder()
    .setColor(0xc9a84c)
    .setTitle('📜 Personnages disponibles')
    .setDescription(total === 0 ? '*Aucun personnage dans cette catégorie.*' : lines.join('\n'))
    .setFooter({ text: `Page ${p + 1}/${pages} · ${total} carte(s) · Filtre : ${filterLabel} · Tri : ${sortLabel}` });

  return { embed, page: p, pages };
}

function encodeState(page, sort, filter) { return `${page}|${sort}|${filter}`; }
function decodeState(str) { const [p, s, f] = str.split('|'); return { page: parseInt(p), sort: s, filter: f }; }

function buildRows(page, pages, sort, filter) {
  const s = encodeState(page, sort, filter);
  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`liste:prev:${s}`).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId(`liste:next:${s}`).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= pages - 1),
    new ButtonBuilder().setCustomId(`liste:sort:${encodeState(0,'added',filter)}`).setLabel('📅 Ajout').setStyle(sort==='added'?ButtonStyle.Primary:ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`liste:sort:${encodeState(0,'alpha',filter)}`).setLabel('🔤 A–Z').setStyle(sort==='alpha'?ButtonStyle.Primary:ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`liste:sort:${encodeState(0,'rarity',filter)}`).setLabel('⭐ Rareté').setStyle(sort==='rarity'?ButtonStyle.Primary:ButtonStyle.Secondary),
  );
  const filterSel = new StringSelectMenuBuilder()
    .setCustomId(`liste:filter:${encodeState(0, sort, filter)}`)
    .setPlaceholder(`Filtre : ${filter === 'all' ? 'Toutes' : rarityInfo(filter).label}`)
    .addOptions([
      { label:'Toutes',      value:'all' },
      { label:'Commun',      value:'commun' },
      { label:'Rare',        value:'rare' },
      { label:'Épique',      value:'epique' },
      { label:'Légendaire',  value:'legendaire' },
      { label:'Onirique',    value:'onirique' },
    ]);
  return [nav, new ActionRowBuilder().addComponents(filterSel)];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('liste')
    .setDescription('Affiche tous les personnages disponibles dans le jeu'),

  async execute(interaction) {
    const { embed, page, pages } = buildPage(0, 'added', 'all');
    await interaction.reply({ embeds: [embed], components: buildRows(page, pages, 'added', 'all') });
  },

  handles: ['liste'],

  async handleButton(interaction) {
    const [, action, stateStr] = interaction.customId.split(':');
    let { page, sort, filter } = decodeState(stateStr);
    if (action === 'prev') page--;
    if (action === 'next') page++;
    const { embed, page: p, pages } = buildPage(page, sort, filter);
    await interaction.update({ embeds: [embed], components: buildRows(p, pages, sort, filter) });
  },

  async handleSelect(interaction) {
    const [, , stateStr] = interaction.customId.split(':');
    const { sort } = decodeState(stateStr);
    const newFilter = interaction.values[0];
    const { embed, page, pages } = buildPage(0, sort, newFilter);
    await interaction.update({ embeds: [embed], components: buildRows(page, pages, sort, newFilter) });
  },
};
