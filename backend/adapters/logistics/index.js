// Adaptador del operador logístico. SHIPPING_PROVIDER=simulated (único disponible) genera
// guías de despacho y de devolución inversa sin contratar ningún envío real.
// El consecutivo diario lo asigna backend/logistics.js a partir de las guías ya guardadas.
// Modo manual (manualShipment): cuando no hay API del operador, bodega o administración
// registran la transportadora y el número de guía reales. Solo la interfaz: la ruta y la
// pantalla que lo usan son del stream E1.
const { selectProvider } = require('../select');

const INTERFACE = ['createShipment', 'createReturnShipment'];

function dateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

// Días festivos oficiales en Colombia para 2026 (Ley Emiliani).
const COLOMBIAN_HOLIDAYS_2026 = new Set([
  '2026-01-01', '2026-01-12', // Año Nuevo, Reyes Magos
  '2026-03-23', // San José
  '2026-04-02', '2026-04-03', // Jueves y Viernes Santo
  '2026-05-01', '2026-05-18', // Día del Trabajo, Ascensión
  '2026-06-08', '2026-06-15', '2026-06-29', // Corpus Christi, Sagrado Corazón, San Pedro y San Pablo
  '2026-07-20', // Independencia
  '2026-08-07', '2026-08-17', // Batalla de Boyacá, Asunción
  '2026-10-12', // Día de la Raza
  '2026-11-02', '2026-11-16', // Todos los Santos, Independencia de Cartagena
  '2026-12-08', '2026-12-25'  // Inmaculada Concepción, Navidad
]);

function isHoliday(date) {
  const d = new Date(date);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return COLOMBIAN_HOLIDAYS_2026.has(key);
}

// Suma días hábiles (lunes a viernes, descontando festivos oficiales colombianos).
function addBusinessDays(date, days) {
  const d = new Date(date);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6 && !isHoliday(d)) {
      added++;
    }
  }
  return d;
}

const simulatedProvider = {
  name: 'simulated',
  carrier: 'Operador logístico SIMULADO',
  dateKey,

  // Guía de despacho: TCB-AAAAMMDD-0001
  createShipment({ reference, address, recipient, sequence, now = new Date() }) {
    const trackingNumber = `TCB-${dateKey(now)}-${String(sequence).padStart(4, '0')}`;
    return {
      trackingNumber,
      carrier: this.carrier,
      reference,
      address,
      recipient,
      estimatedDelivery: addBusinessDays(now, 2).toISOString(),
      simulated: true,
      events: [{ status: 'SHIPPED', label: 'Guía generada y paquete recogido', at: new Date(now).toISOString() }]
    };
  },

  // Guía de devolución inversa: TCB-DEV-AAAAMMDD-0001
  createReturnShipment({ reference, address, recipient, sequence, pickupDate, now = new Date() }) {
    return {
      trackingNumber: `TCB-DEV-${dateKey(now)}-${String(sequence).padStart(4, '0')}`,
      carrier: this.carrier,
      reference,
      address,
      recipient,
      pickupDate,
      simulated: true,
      events: [{ status: 'PICKUP_SCHEDULED', label: `Recogida agendada para ${pickupDate}`, at: new Date(now).toISOString() }]
    };
  }
};

// Guía registrada a mano (transportadora y número que entrega el operador). Lanza un error
// con status 400 y mensaje en español si falta alguno o el número no tiene un formato sensato.
function manualShipment({ reference, address, recipient, carrier, trackingNumber, now = new Date() } = {}) {
  const cleanCarrier = String(carrier || '').trim();
  const cleanTracking = String(trackingNumber || '').trim().toUpperCase();
  const fail = message => Object.assign(new Error(message), { status: 400, code: 'INVALID_SHIPMENT' });
  if (cleanCarrier.length < 2 || cleanCarrier.length > 60) throw fail('Escribe el nombre de la transportadora.');
  if (!/^[A-Z0-9-]{4,40}$/.test(cleanTracking)) throw fail('El número de guía debe tener entre 4 y 40 letras, números o guiones.');
  return {
    trackingNumber: cleanTracking,
    carrier: cleanCarrier,
    reference,
    address,
    recipient,
    estimatedDelivery: null,
    simulated: false,
    manual: true,
    events: [{ status: 'SHIPPED', label: `Guía registrada a mano (${cleanCarrier})`, at: new Date(now).toISOString() }]
  };
}

const PROVIDERS = { simulated: simulatedProvider };
const provider = selectProvider({ variable: 'SHIPPING_PROVIDER', providers: PROVIDERS, methods: INTERFACE });

module.exports = { ...provider, INTERFACE, manualShipment, addBusinessDays };
