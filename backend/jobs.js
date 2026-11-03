// Tareas programadas del backend.
const { db } = require('./database');
const mail = require('./mail');
const config = require('./config');

// HU-10: recuerda calificar las cajas entregadas hace REVIEW_REMINDER_DAYS días o más
// que siguen sin calificar. reminderSentAt evita enviar el recordatorio dos veces.
function runReviewReminders(now = new Date()) {
  const thresholdMs = config.REVIEW_REMINDER_DAYS * 86400000;
  const sent = [];

  db.data.boxes.forEach(box => {
    if (box.status !== 'DELIVERED' || !box.deliveredAt || box.reminderSentAt) return;
    if (now - new Date(box.deliveredAt) < thresholdMs) return;
    const ratedCount = db.getRatingsByBox(box.id).length;
    if (ratedCount >= (box.itemIds || []).length) return;

    const user = db.findUserById(box.userId);
    if (!user) return;
    mail.send({
      to: user.email,
      type: 'REVIEW_REMINDER',
      subject: `¿Cómo te quedó tu caja #${box.cycle}?`,
      body: `Hola ${user.name}, tu caja #${box.cycle} llegó hace ${config.REVIEW_REMINDER_DAYS} días o más y aún no la calificas. Cuéntanos el ajuste y el estilo de cada prenda en ${config.APP_BASE_URL}/#/caja para afinar tu próxima selección.`
    });
    box.reminderSentAt = now.toISOString();
    sent.push(box.id);
  });

  if (sent.length > 0) db.save();
  return { sent: sent.length, boxIds: sent };
}

let timer = null;

function startJobs() {
  runReviewReminders();
  timer = setInterval(() => runReviewReminders(), config.REVIEW_REMINDER_INTERVAL_MS);
  timer.unref();
}

function stopJobs() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { runReviewReminders, startJobs, stopJobs };
