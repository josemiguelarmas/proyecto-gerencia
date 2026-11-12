// Box helpers shared by the profile, boxes and stylist route modules: the status groups
// that decide whether a box passed the stylist review, and createCuratedBox, which asks the
// recommendation engine for a proposal and stores it as a PROPOSED box for the stylist queue.
const { db } = require('../database');
const { curateBox } = require('../engine');
const config = require('../config');

// HU-07: estados que significan que la caja ya pasó la revisión del estilista.
// Las cajas creadas antes de HU-07 (PREPARING, SHIPPED…) se consideran aprobadas.
const UNAPPROVED_STATUSES = ['PROPOSED', 'REJECTED'];
const OPEN_BOX_STATUSES = ['PROPOSED', 'APPROVED', 'PREPARING', 'SHIPPED', 'CREATED'];
const NOT_APPROVED_ERROR = 'La caja no ha sido aprobada';

function createCuratedBox(userId, profile, { cycle, address, receivedIds = [], excludeIds = [] }) {
  const curated = curateBox(profile, db.catalog, receivedIds, { excludeIds });
  const box = db.createBox(userId, {
    cycle,
    status: 'PROPOSED',
    plan: profile.plan || 'esencial',
    address,
    itemIds: curated.itemIds,
    recommendations: curated.recommendations,
    totalCostCOP: curated.totalCostCOP,
    targetCostCOP: curated.targetCostCOP,
    withinCap: curated.withinCap,
    outfits: curated.outfits,
    outfitScore: curated.outfitScore,
    modelVersion: curated.modelVersion,
    // HU-11: con qué reglas y qué revisión del perfil aprendido se armó la caja
    rulesVersion: config.RULES_VERSION,
    profileLearningRevision: profile.learningRevision || 0
  });
  return { box, curated };
}

module.exports = { UNAPPROVED_STATUSES, OPEN_BOX_STATUSES, NOT_APPROVED_ERROR, createCuratedBox };
