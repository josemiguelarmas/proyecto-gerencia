// Adaptador del operador logístico. SHIPPING_PROVIDER=simulated (único disponible) genera
// guías de despacho y de devolución inversa sin contratar ningún envío real.
// El consecutivo diario lo asigna backend/logistics.js a partir de las guías ya guardadas.

function dateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

// Suma días hábiles (lunes a viernes). No descuenta festivos.
function addBusinessDays(date, days) {
  const d = new Date(date);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
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

const PROVIDERS = { simulated: simulatedProvider };
const providerName = process.env.SHIPPING_PROVIDER || 'simulated';
if (!PROVIDERS[providerName]) {
  throw new Error(`SHIPPING_PROVIDER desconocido: ${providerName}. Disponibles: ${Object.keys(PROVIDERS).join(', ')}`);
}

module.exports = { ...PROVIDERS[providerName], addBusinessDays: addBusinessDays };
