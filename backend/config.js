// Configuración central de reglas de negocio (Sprint 2).
// Las constantes compartidas con el frontend se exponen en GET /api/config.

const POLICY = {
  version: 'v1.0',
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
  // HU-10: días desde la entrega para recordar la calificación, y frecuencia del job.
  REVIEW_REMINDER_DAYS: Number(process.env.REVIEW_REMINDER_DAYS) || 3,
  REVIEW_REMINDER_INTERVAL_MS: 60 * 60 * 1000,
  // HU-13: motivos de la encuesta de salida.
  CANCELLATION_REASONS: {
    precio: 'Precio',
    estilo: 'El estilo no acertó',
    talla: 'Talla',
    tiempo: 'Tiempo',
    otro: 'Otro'
  }
};
