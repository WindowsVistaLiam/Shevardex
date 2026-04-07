const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const { readCards }            = require('../utils/cards');
const { searchInCollection }   = require('../utils/search');
const { rarityInfo }           = require('../utils/embeds');
const db                       = require('../database');

// ── Stockage en mémoire des échanges actifs ────────────────────────────────
// clé : tradeId, valeur : état de l'échange
const trades = new Map();
function uid() { return Math.random().toString(36).slice(2, 10); }

// Expire automatiquement après 10 minutes
function setExpiry(tradeId) {
  setTimeout(() => trades.delete(tradeId), 10 * 60 * 1000);
}

// ── Embed de l'échange ─────────────────────────────────────────────────────
function tradeEmbed(trade) {
  const { cards } = readCards();

  if (trade.status === 'awaiting_accept') {
    return new EmbedBuilder()
      .setColor(0xc9a84c)
      .setTitle('⚔️ Demande d\'échange')
      .setDescription(`<@${trade.targetId}>, **<@${trade.initiatorId}> souhaite échanger avec toi !**\nAcceptes-tu ?`);
  }

  if (trade.status === 'selecting') {
    const iOk = trade.initiatorCard ? '✅' : '⏳ En attente…';
    const tOk = trade.targetCard    ? '✅' : '⏳ En attente…';
    return new EmbedBuilder()
      .setColor(0xc9a84c)
      .setTitle('⚔️ Échange en cours')
      .addFields(
        { name: `<@${trade.initiatorId}>`, value: iOk, inline: true },
        { name: `<@${trade.targetId}>`,    value: tOk, inline: true },
      );
  }

  if (trade.status === 'awaiting_confirm') {
    const iCard = cards.find(c => c.id === trade.initiatorCard.cardId);
    const tCard = cards.find(c => c.id === trade.targetCard.cardId);
    const iR    = rarityInfo(iCard?.rarity);
    const tR    = rarityInfo(tCard?.rarity);
    const iConf = trade.initiatorConfirmed ? '✅ Confirmé' : '⏳ En attente';
    const tConf = trade.targetConfirmed    ? '✅ Confirmé' : '⏳ En attente';
    return new EmbedBuilder()
      .setColor(0xc9a84c)
      .setTitle('⚔️ Confirmation de l\'échange')
      .setDescription('Chacun doit confirmer pour finaliser l\'échange.')
      .addFields(
        { name: `<@${trade.initiatorId}> propose`, value: `${iR.emoji} **${iCard?.name ?? '?'}**\n${iConf}`, inline: true },
        { name: `<@${trade.targetId}> propose`,    value: `${tR.emoji} **${tCard?.name ?? '?'}**\n${tConf}`, inline: true },
      );
  }
}

// ── Boutons selon le statut ────────────────────────────────────────────────
function tradeButtons(trade, tradeId) {
  if (trade.status === 'awaiting_accept') {
    return [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`echange:accept:${tradeId}`).setLabel('✅ Accepter').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`echange:refuse:${tradeId}`).setLabel('❌ Refuser').setStyle(ButtonStyle.Danger),
    )];
  }
  if (trade.status === 'selecting') {
    return [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`echange:propose:${tradeId}`).setLabel('⚔️ Proposer ma carte').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`echange:cancel:${tradeId}`).setLabel('Annuler').setStyle(ButtonStyle.Secondary),
    )];
  }
  if (trade.status === 'awaiting_confirm') {
    return [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`echange:confirm:${tradeId}`).setLabel('✅ Confirmer').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`echange:cancel:${tradeId}`).setLabel('❌ Annuler').setStyle(ButtonStyle.Danger),
    )];
  }
  return [];
}

// Édite le message principal de l'échange (appelé depuis des interactions autres que la réponse originale)
async function updateTradeMessage(client, trade, tradeId) {
  try {
    const channel = await client.channels.fetch(trade.channelId);
    const msg     = await channel.messages.fetch(trade.messageId);
    await msg.edit({ embeds: [tradeEmbed(trade)], components: tradeButtons(trade, tradeId) });
  } catch (e) {
    console.error('[echange] Impossible de mettre à jour le message:', e.message);
  }
}

// ── Sélection de carte après soumission modale ou select ──────────────────
async function applyCardSelection(interaction, trade, tradeId, userId, collectionEntry, isUpdate) {
  const { cards } = readCards();
  const card = cards.find(c => c.id === collectionEntry.card_id);
  const isInitiator = userId === trade.initiatorId;

  if (isInitiator) trade.initiatorCard = { collectionId: collectionEntry.id, cardId: collectionEntry.card_id };
  else             trade.targetCard    = { collectionId: collectionEntry.id, cardId: collectionEntry.card_id };

  const r        = rarityInfo(card?.rarity);
  const feedback = `✅ Carte enregistrée : ${r.emoji} **${card?.name ?? collectionEntry.card_id}**`;
  const payload  = { content: feedback, components: [], ephemeral: true };

  if (isUpdate) await interaction.update(payload);
  else          await interaction.reply(payload);

  // Si les deux ont choisi → passer en confirmation
  if (trade.initiatorCard && trade.targetCard) {
    trade.status = 'awaiting_confirm';
    await updateTradeMessage(interaction.client, trade, tradeId);
  } else {
    // Mettre à jour le message (✅ pour l'un, ⏳ pour l'autre)
    await updateTradeMessage(interaction.client, trade, tradeId);
  }
}

// ─────────────────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('echange')
    .setDescription('Proposer un échange de carte à un autre joueur')
    .addUserOption(o => o.setName('joueur').setDescription('Joueur avec qui échanger').setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser('joueur');

    if (target.id === interaction.user.id)
      return interaction.reply({ content: '❌ Vous ne pouvez pas échanger avec vous-même.', ephemeral: true });
    if (target.bot)
      return interaction.reply({ content: '❌ Vous ne pouvez pas échanger avec un bot.', ephemeral: true });

    const myColl = db.prepare('SELECT id FROM collection WHERE user_id = ? LIMIT 1').get(interaction.user.id);
    if (!myColl)
      return interaction.reply({ content: '❌ Vous n\'avez aucune carte à proposer.', ephemeral: true });

    const tradeId = uid();
    const trade   = {
      initiatorId:       interaction.user.id,
      targetId:          target.id,
      channelId:         interaction.channelId,
      messageId:         null,
      status:            'awaiting_accept',
      initiatorCard:     null,
      targetCard:        null,
      initiatorConfirmed:false,
      targetConfirmed:   false,
    };
    trades.set(tradeId, trade);
    setExpiry(tradeId);

    const msg = await interaction.reply({
      embeds: [tradeEmbed(trade)],
      components: tradeButtons(trade, tradeId),
      fetchReply: true,
    });
    trade.messageId = msg.id;
  },

  // ── Déclaration des préfixes de customId gérés ──────────────────────────
  handles: ['echange'],

  // ── Boutons ──────────────────────────────────────────────────────────────
  async handleButton(interaction) {
    const parts   = interaction.customId.split(':');
    const action  = parts[1];
    const tradeId = parts[2];
    const trade   = trades.get(tradeId);

    if (!trade)
      return interaction.reply({ content: '❌ Cet échange a expiré.', ephemeral: true });

    const isParticipant = [trade.initiatorId, trade.targetId].includes(interaction.user.id);

    // ── Accepter ────────────────────────────────────────────────────────
    if (action === 'accept') {
      if (interaction.user.id !== trade.targetId)
        return interaction.reply({ content: '❌ Cette demande ne vous est pas adressée.', ephemeral: true });

      const theirColl = db.prepare('SELECT id FROM collection WHERE user_id = ? LIMIT 1').get(trade.targetId);
      if (!theirColl) {
        trades.delete(tradeId);
        return interaction.update({
          embeds: [new EmbedBuilder().setColor(0xff0000).setTitle('❌ Échange annulé').setDescription('Vous n\'avez aucune carte à proposer.')],
          components: [],
        });
      }
      trade.status = 'selecting';
      await interaction.update({ embeds: [tradeEmbed(trade)], components: tradeButtons(trade, tradeId) });
      return;
    }

    // ── Refuser ─────────────────────────────────────────────────────────
    if (action === 'refuse') {
      if (interaction.user.id !== trade.targetId)
        return interaction.reply({ content: '❌ Cette demande ne vous est pas adressée.', ephemeral: true });
      trades.delete(tradeId);
      return interaction.update({
        embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('❌ Échange refusé').setDescription(`<@${trade.targetId}> a refusé l'échange.`)],
        components: [],
      });
    }

    // ── Proposer (ouvrir la modale) ──────────────────────────────────────
    if (action === 'propose') {
      if (!isParticipant)
        return interaction.reply({ content: '❌ Cet échange ne vous concerne pas.', ephemeral: true });
      if (trade.status !== 'selecting')
        return interaction.reply({ content: '❌ Ce n\'est pas le moment de choisir.', ephemeral: true });

      const isInitiator = interaction.user.id === trade.initiatorId;
      if (isInitiator && trade.initiatorCard)
        return interaction.reply({ content: '✅ Vous avez déjà choisi votre carte.', ephemeral: true });
      if (!isInitiator && trade.targetCard)
        return interaction.reply({ content: '✅ Vous avez déjà choisi votre carte.', ephemeral: true });

      const modal = new ModalBuilder()
        .setCustomId(`echange:card_modal:${tradeId}:${interaction.user.id}`)
        .setTitle('Quelle carte proposez-vous ?');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('card_name')
          .setLabel('Nom de la carte (peut être partiel)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: aelindra, tork, sylv…')
          .setRequired(true)
      ));
      await interaction.showModal(modal);
      return;
    }

    // ── Confirmer ────────────────────────────────────────────────────────
    if (action === 'confirm') {
      if (!isParticipant)
        return interaction.reply({ content: '❌ Cet échange ne vous concerne pas.', ephemeral: true });
      if (trade.status !== 'awaiting_confirm')
        return interaction.reply({ content: '❌ L\'échange n\'est pas encore en phase de confirmation.', ephemeral: true });

      const isInitiator = interaction.user.id === trade.initiatorId;
      if (isInitiator) trade.initiatorConfirmed = true;
      else             trade.targetConfirmed    = true;

      if (trade.initiatorConfirmed && trade.targetConfirmed) {
        // ── Exécuter l'échange ──
        const iEntry = db.prepare('SELECT * FROM collection WHERE id = ? AND user_id = ?').get(trade.initiatorCard.collectionId, trade.initiatorId);
        const tEntry = db.prepare('SELECT * FROM collection WHERE id = ? AND user_id = ?').get(trade.targetCard.collectionId,   trade.targetId);

        if (!iEntry || !tEntry) {
          trades.delete(tradeId);
          return interaction.update({
            embeds: [new EmbedBuilder().setColor(0xff0000).setTitle('❌ Échange impossible').setDescription('Une des cartes n\'est plus disponible dans la collection.')],
            components: [],
          });
        }

        db.prepare('UPDATE collection SET user_id = ? WHERE id = ?').run(trade.targetId,   iEntry.id);
        db.prepare('UPDATE collection SET user_id = ? WHERE id = ?').run(trade.initiatorId, tEntry.id);

        const { cards } = readCards();
        const iCard = cards.find(c => c.id === iEntry.card_id);
        const tCard = cards.find(c => c.id === tEntry.card_id);
        const iR    = rarityInfo(iCard?.rarity);
        const tR    = rarityInfo(tCard?.rarity);

        const doneEmbed = new EmbedBuilder()
          .setColor(0x4ade80)
          .setTitle('✅ Échange réalisé !')
          .addFields(
            { name: `<@${trade.initiatorId}> a reçu`, value: `${tR.emoji} **${tCard?.name ?? '?'}**`, inline: true },
            { name: `<@${trade.targetId}> a reçu`,    value: `${iR.emoji} **${iCard?.name ?? '?'}**`, inline: true },
          );
        trades.delete(tradeId);
        return interaction.update({ embeds: [doneEmbed], components: [] });
      }

      // Un seul a confirmé : mettre à jour l'embed
      await interaction.update({ embeds: [tradeEmbed(trade)], components: tradeButtons(trade, tradeId) });
      return;
    }

    // ── Annuler ──────────────────────────────────────────────────────────
    if (action === 'cancel') {
      if (!isParticipant)
        return interaction.reply({ content: '❌ Cet échange ne vous concerne pas.', ephemeral: true });
      trades.delete(tradeId);
      return interaction.update({
        embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('❌ Échange annulé').setDescription(`Annulé par <@${interaction.user.id}>.`)],
        components: [],
      });
    }
  },

  // ── Select menus (désambiguïsation de carte) ──────────────────────────
  async handleSelect(interaction) {
    const [, , tradeId, userId] = interaction.customId.split(':');
    if (interaction.user.id !== userId)
      return interaction.reply({ content: '❌ Ce menu ne vous est pas destiné.', ephemeral: true });

    const trade = trades.get(tradeId);
    if (!trade)
      return interaction.update({ content: '❌ Échange expiré.', components: [] });

    const collectionId = parseInt(interaction.values[0]);
    const entry = db.prepare('SELECT * FROM collection WHERE id = ? AND user_id = ?').get(collectionId, userId);
    if (!entry)
      return interaction.update({ content: '❌ Carte introuvable dans votre collection.', components: [] });

    await applyCardSelection(interaction, trade, tradeId, userId, entry, true);
  },

  // ── Modales (saisie du nom de la carte) ──────────────────────────────
  async handleModal(interaction) {
    const [, , tradeId, userId] = interaction.customId.split(':');
    if (interaction.user.id !== userId) return;

    const trade = trades.get(tradeId);
    if (!trade)
      return interaction.reply({ content: '❌ Échange expiré.', ephemeral: true });

    const query      = interaction.fields.getTextInputValue('card_name');
    const { cards }  = readCards();
    const collection = db.prepare('SELECT * FROM collection WHERE user_id = ?').all(userId);
    const results    = searchInCollection(collection, cards, query);

    if (!results.length)
      return interaction.reply({ content: `❌ Aucune carte "*${query}*" dans votre collection.`, ephemeral: true });

    if (results.length === 1) {
      const entry = db.prepare('SELECT * FROM collection WHERE user_id = ? AND card_id = ? LIMIT 1').get(userId, results[0].card_id);
      return applyCardSelection(interaction, trade, tradeId, userId, entry, false);
    }

    // Plusieurs résultats : menu déroulant
    const options = results.slice(0, 25).map(r => ({
      label: r.card.name.slice(0, 100),
      description: rarityInfo(r.card.rarity).label,
      value: r.id.toString(),
    }));
    await interaction.reply({
      content: `🔍 Plusieurs cartes trouvées :`,
      components: [new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`echange:disambig:${tradeId}:${userId}`)
          .setPlaceholder('Choisissez votre carte')
          .addOptions(options)
      )],
      ephemeral: true,
    });
  },
};
