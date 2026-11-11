// Adaptador de facturación electrónica. INVOICING_PROVIDER=simulated (único disponible)
// imita el ambiente de habilitación de la DIAN: valida el documento, devuelve un CUFE
// simulado y nunca transmite nada. INVOICING_FAIL=1 (o setDowntime(true) en pruebas) simula
// que el proveedor no responde; las facturas quedan en la cola de reintentos de billing.js.
const crypto = require('crypto');
const { selectProvider } = require('../select');

const INTERFACE = ['issue', 'isDown'];
let downtime = null; // null: lo decide INVOICING_FAIL; true/false: fijado con setDowntime()

const simulatedProvider = {
  name: 'simulated',
  environment: 'HABILITACION',

  isDown() {
    return downtime === null ? process.env.INVOICING_FAIL === '1' : downtime;
  },

  // Interruptor de caída del proveedor para pruebas y demos; null vuelve a leer INVOICING_FAIL.
  setDowntime(value) {
    downtime = value === null ? null : Boolean(value);
  },

  issue(invoice) {
    if (this.isDown()) {
      const err = new Error('El proveedor de facturación no respondió (SIMULADO, INVOICING_FAIL=1).');
      err.code = 'PROVIDER_UNAVAILABLE';
      throw err;
    }
    const { buyer } = invoice;
    if (!buyer || !buyer.docType || !buyer.docNumber || !buyer.address || !buyer.city) {
      const err = new Error('Faltan datos fiscales del adquiriente.');
      err.code = 'INVALID_BUYER';
      throw err;
    }
    const cufe = crypto
      .createHash('sha384')
      .update(`${invoice.number}|${invoice.issuedAt}|${invoice.totalCOP}|${buyer.docNumber}|simulado`)
      .digest('hex');
    return { status: 'ACCEPTED', cufe, environment: 'HABILITACION', provider: 'simulated', simulated: true };
  }
};

const PROVIDERS = { simulated: simulatedProvider };

module.exports = Object.assign(selectProvider({ variable: 'INVOICING_PROVIDER', providers: PROVIDERS, methods: INTERFACE }), { INTERFACE });
