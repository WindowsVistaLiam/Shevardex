const db = require('../database');

function getConfig(key) {
  return db.prepare('SELECT value FROM config WHERE key = ?').get(key)?.value ?? null;
}

function ensure(userId) {
  db.prepare('INSERT OR IGNORE INTO players (user_id, pulls, last_update) VALUES (?, ?, ?)')
    .run(userId, parseInt(getConfig('max_pulls')) || 10, Math.floor(Date.now() / 1000));
}

/**
 * Calcule le nombre de pulls actuels d'un joueur en tenant compte de la recharge
 * passée depuis la dernière mise à jour, et met à jour la DB si nécessaire.
 */
function getCurrentPulls(userId) {
  ensure(userId);
  const player       = db.prepare('SELECT * FROM players WHERE user_id = ?').get(userId);
  const pullsPerHour = parseInt(getConfig('pulls_per_hour')) || 1;
  const maxPulls     = parseInt(getConfig('max_pulls'))      || 10;

  // Ne recharger que si sous le cap
  if (player.pulls < maxPulls) {
    const now         = Math.floor(Date.now() / 1000);
    const secsPerPull = 3600 / pullsPerHour;
    const elapsed     = now - player.last_update;
    const gained      = Math.floor(elapsed / secsPerPull);

    if (gained > 0) {
      const add       = Math.min(gained, maxPulls - player.pulls);
      const newPulls  = player.pulls + add;
      // Avancer last_update du nombre de pulls consommés (pour ne pas perdre les secondes restantes)
      const newUpdate = player.last_update + Math.round(add * secsPerPull);
      db.prepare('UPDATE players SET pulls = ?, last_update = ? WHERE user_id = ?')
        .run(newPulls, newUpdate, userId);
      return newPulls;
    }
  }
  return player.pulls;
}

/**
 * Utilise jusqu'à `count` pulls. Retourne le nombre réellement utilisés.
 */
function usePulls(userId, count) {
  const current = getCurrentPulls(userId);
  const used    = Math.min(count, current);
  db.prepare('UPDATE players SET pulls = ? WHERE user_id = ?').run(current - used, userId);
  return used;
}

/**
 * Ajoute des pulls (récompense staff) — sans cap, peut dépasser max_pulls.
 */
function addPulls(userId, amount) {
  ensure(userId);
  const current = getCurrentPulls(userId);
  const newVal  = current + amount;
  db.prepare('UPDATE players SET pulls = ? WHERE user_id = ?').run(newVal, userId);
  return newVal;
}

/**
 * Retourne le temps en secondes avant le prochain pull, ou null si déjà au cap.
 */
function getNextPullIn(userId) {
  ensure(userId);
  const player       = db.prepare('SELECT * FROM players WHERE user_id = ?').get(userId);
  const maxPulls     = parseInt(getConfig('max_pulls'))      || 10;
  if (player.pulls >= maxPulls) return null;
  const pullsPerHour = parseInt(getConfig('pulls_per_hour')) || 1;
  const secsPerPull  = 3600 / pullsPerHour;
  const now          = Math.floor(Date.now() / 1000);
  const elapsed      = now - player.last_update;
  return Math.ceil(secsPerPull - (elapsed % secsPerPull));
}

/**
 * Formate un nombre de secondes en "Xh Ymin Zs" lisible.
 */
function formatDuration(secs) {
  if (secs <= 0) return '0s';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}min`);
  if (s && !h) parts.push(`${s}s`); // on n'affiche les secondes que si < 1h
  return parts.join(' ');
}

module.exports = { getCurrentPulls, usePulls, addPulls, getNextPullIn, getConfig, ensure, formatDuration };
