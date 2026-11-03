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

module.exports = {
  POLICY,
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
