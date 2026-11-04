// Adaptador de facturación electrónica. INVOICING_PROVIDER=simulated (único disponible)
// imita el ambiente de habilitación de la DIAN: valida el documento, devuelve un CUFE
// simulado y nunca transmite nada. INVOICING_FAIL=1 simula que el proveedor no responde.
const crypto = require('crypto');

const simulatedProvider = {
  name: 'simulated',
  environment: 'HABILITACION',

  issue(invoice) {
    if (process.env.INVOICING_FAIL === '1') {
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
const providerName = process.env.INVOICING_PROVIDER || 'simulated';
if (!PROVIDERS[providerName]) {
  throw new Error(`INVOICING_PROVIDER desconocido: ${providerName}. Disponibles: ${Object.keys(PROVIDERS).join(', ')}`);
}

module.exports = PROVIDERS[providerName];
