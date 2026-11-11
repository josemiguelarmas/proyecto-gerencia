// Configuración central de reglas de negocio (Sprint 2).
// Las constantes compartidas con el frontend se exponen en GET /api/config.
const env = require('./config/env');

const POLICY = {
  version: env.POLICY_VERSION,
  pendingLegalReview: true,
  title: 'Política de Tratamiento de Datos Personales',
  text: [
    'PENDIENTE DE REVISIÓN LEGAL. Este texto es una base de trabajo y no ha sido validado por un abogado.',
    'En cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013, The Clothes Box (en adelante, "el Responsable") informa que los datos personales que suministras (nombre, correo, fecha de nacimiento, dirección de entrega, medidas corporales y preferencias de estilo) serán tratados para: (a) crear y administrar tu cuenta; (b) recomendar y despachar las prendas de tu caja mensual; (c) gestionar cambios por talla, pagos y facturación; (d) enviarte comunicaciones transaccionales relacionadas con el servicio.',
    'Las medidas corporales se consideran datos sensibles. Su suministro es facultativo y se usan exclusivamente para calcular la talla de cada prenda.',
    'Como titular tienes derecho a conocer, actualizar, rectificar y suprimir tus datos, a solicitar prueba de esta autorización, a ser informado sobre el uso de tus datos y a presentar quejas ante la Superintendencia de Industria y Comercio. Puedes ejercer estos derechos desde "Mi Perfil" o escribiendo a datos@theclothesbox.co.',
    'Tus datos no se venden ni se comparten con terceros distintos de los encargados necesarios para prestar el servicio (operador logístico, pasarela de pagos y proveedor de facturación electrónica).'
  ]
};

// HU-06: costo objetivo por plan, sustentado en el precio del plan.
// costo objetivo = precio - comisión pasarela (3,5 %) - logística y empaque - margen mínimo (10 % del precio)
// La logística (12.000 COP por caja) y el margen son supuestos pendientes de validar con el equipo.
const PAYMENT_FEE_RATE = 0.035;
const LOGISTICS_COST_COP = 12000;
const MIN_MARGIN_RATE = 0.10;

function targetCost(priceCOP) {
  return Math.round(priceCOP * (1 - PAYMENT_FEE_RATE - MIN_MARGIN_RATE) - LOGISTICS_COST_COP);
}

const PLANS = {
  esencial: { name: 'Esencial', priceCOP: 129900, items: 3, slots: ['top', 'bottom', 'capa'] },
  estilo: { name: 'Estilo', priceCOP: 199900, items: 5, slots: ['top', 'bottom', 'capa', 'top', 'bottom'] }
};
Object.values(PLANS).forEach(plan => { plan.targetCostCOP = targetCost(plan.priceCOP); });

// SCRUM-58 (stream D1): share of the plan price used as target garment cost (assumption).
const PLAN_TARGET_COST_RATE = Number(process.env.PLAN_TARGET_COST_RATE) > 0 ? Number(process.env.PLAN_TARGET_COST_RATE) : 0.40;

// HU-14: plazo único de cambio por talla, en días hábiles desde la entrega (lo lee también el frontend).
const RETURN_WINDOW_BUSINESS_DAYS = Number(process.env.RETURN_WINDOW_BUSINESS_DAYS) || 5;

module.exports = {
  POLICY,
  PLANS,
  PAYMENT_FEE_RATE,
  LOGISTICS_COST_COP,
  MIN_MARGIN_RATE,
  // HU-05: si una prenda no trae precio mayorista se estima como este % del precio de venta (supuesto).
  WHOLESALE_RATIO_DEFAULT: 0.30,
  INITIAL_VARIANT_STOCK: 10,
  SIZES: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  CATEGORIES: ['top', 'bottom', 'capa'],
  STYLES: ['urbano', 'minimal', 'retro', 'clasico', 'deportivo', 'artesanal'],
  OCCASIONS: ['clase', 'fiesta', 'entrevista'],
  // HU-03: meta de tiempo del quiz en segundos.
  QUIZ_TARGET_SECONDS: 180,
  MIN_AGE: 18,
  PASSWORD_RESET_TTL_MS: 60 * 60 * 1000,
  APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:3000',
  // HU-10: días desde la entrega para recordar la calificación.
  REVIEW_REMINDER_DAYS: Number(process.env.REVIEW_REMINDER_DAYS) || 3,
  // HU-13: motivos de la encuesta de salida.
  CANCELLATION_REASONS: {
    precio: 'Precio',
    estilo: 'El estilo no acertó',
    talla: 'Talla',
    tiempo: 'Tiempo',
    otro: 'Otro'
  },
  // HU-08: reintentos del cobro recurrente, en días desde el primer fallo ("1,3,5").
  PAYMENT_RETRY_DAYS: (process.env.PAYMENT_RETRY_DAYS || '1,3,5').split(',').map(Number).filter(n => n > 0),
  PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET || 'whsec_simulado_desarrollo',
  // F7: los jobs se revisan cada hora (backend/jobs/index.js). El lote mensual de cajas corre
  // solo el día BOX_BATCH_DAY de cada mes (supuesto: día 1, pendiente de confirmar con el equipo).
  JOBS_INTERVAL_MS: 60 * 60 * 1000,
  BOX_BATCH_DAY: Number(process.env.BOX_BATCH_DAY) || 1,
  // HU-12: día del mes desde el que un cambio de plan ya no alcanza la próxima caja.
  SUBSCRIPTION_CUTOFF_DAY: Number(process.env.SUBSCRIPTION_CUTOFF_DAY) || 25,
  PAUSE_MONTHS: 1,
  // HU-15: facturación electrónica. El precio del plan incluye IVA del 19 % (supuesto pendiente de validar con contador).
  IVA_RATE: 0.19,
  INVOICE_PREFIX: 'SETT',
  INVOICE_RETRY_MINUTES: [5, 30, 120],
  TEAM_ALERT_EMAIL: 'operaciones@theclothesbox.co',
  ISSUER: { name: 'The Clothes Box S.A.S. (SIMULADO)', nit: '900000000-0', city: 'Cali' },
  FISCAL_DOC_TYPES: { CC: 'Cédula de ciudadanía', CE: 'Cédula de extranjería', NIT: 'NIT', PA: 'Pasaporte' },
  RETURN_WINDOW_BUSINESS_DAYS,
  // HU-11: versión de las reglas del motor y límites del aprendizaje por feedback.
  RULES_VERSION: 'reglas-v2',
  LEARNING: { floor: 0.3, cap: 2, lowStyleScore: 2, lowRatingFactor: 0.6, removedFactor: 0.9, rejectedFactor: 0.95, addedFactor: 1.1, addedStyleBonus: 0.25 },
  // HU-17: umbral de churn mensual por defecto (%), editable desde el panel.
  CHURN_THRESHOLD_DEFAULT: 9,
  // HU-16: plazos de la Ley 1581 para responder (días hábiles): consultas 10, reclamos 15.
  DATA_REQUEST_DEADLINES: { EXPORT: 10, RECTIFICATION: 15, DELETION: 15 },
  RETURN_CONDITIONS: [
    `El cambio se pide dentro de ${RETURN_WINDOW_BUSINESS_DAYS} días hábiles desde la entrega de la caja.`,
    'Solo aplica a problemas de talla o ajuste (muy pequeña, muy grande o de proporciones).',
    'La prenda debe estar sin uso, sin lavar y con sus etiquetas.',
    'La recogida y el envío de la nueva talla no tienen costo en Cali.'
  ],

  // ---- Stream D1 (HU-08/12/13) ----
  // SCRUM-58: plan catalog for billing. targetCost is the target garment cost per box, by default
  // 40 % of the price (ASSUMPTION to confirm with the team; PLAN_TARGET_COST_RATE overrides it).
  // Note: the curation engine still caps boxes with PLANS[plan].targetCostCOP (Sprint 2 formula).
  PLAN_TARGET_COST_RATE,
  PLAN_CONFIG: Object.fromEntries(Object.entries(PLANS).map(([key, plan]) => [key, {
    name: plan.name,
    priceCOP: plan.priceCOP,
    items: plan.items,
    billingCycleMonths: 1,
    targetCost: Math.round(plan.priceCOP * PLAN_TARGET_COST_RATE)
  }]))
};
