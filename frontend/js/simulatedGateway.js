// Simulated payment gateway SDK (HU-08, SCRUM-57). It plays the role of the script a real
// gateway serves to the browser: the card number and CVV are validated and turned into a token
// right here, in the client, and only the token travels to our backend. Nothing is stored.
// The token encodes the test-card behavior, the brand and the last 4 digits, which is what the
// simulated backend adapter reads back (describeToken). This file works in the browser
// (window.TCB.simulatedGateway) and in Node (module.exports) so tests use the same code.
(function (root, factory) {
  const gateway = factory();
  if (typeof module === 'object' && module.exports) module.exports = gateway;
  else {
    root.TCB = root.TCB || {};
    root.TCB.simulatedGateway = gateway;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  // Test cards. Any other Luhn-valid number is approved.
  const TEST_CARDS = {
    '4242424242424242': { behavior: 'ok', label: 'Aprueba siempre' },
    '4000000000000002': { behavior: 'decline', label: 'Rechaza: fondos insuficientes' },
    '4000000000000341': { behavior: 'firstonly', label: 'Aprueba el primer cobro y falla los recurrentes' }
  };

  function luhnValid(number) {
    let sum = 0;
    let double = false;
    for (let i = number.length - 1; i >= 0; i--) {
      let d = Number(number[i]);
      if (double) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      double = !double;
    }
    return sum % 10 === 0;
  }

  function cardBrand(number) {
    if (/^4/.test(number)) return 'Visa';
    if (/^(5[1-5]|2[2-7])/.test(number)) return 'Mastercard';
    if (/^3[47]/.test(number)) return 'Amex';
    return 'Tarjeta';
  }

  function randomHex(bytes) {
    const buf = new Uint8Array(bytes);
    const webCrypto = typeof crypto !== 'undefined' && crypto.getRandomValues ? crypto : require('crypto').webcrypto;
    webCrypto.getRandomValues(buf);
    return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
  }

  function cardError(message) {
    const err = new Error(message);
    err.status = 400;
    return err;
  }

  // Validates the card and returns { token, brand, last4, provider }. Throws with a Spanish message.
  function tokenize({ number, expMonth, expYear, cvc, holder } = {}, now = new Date()) {
    const digits = String(number || '').replace(/[\s-]/g, '');
    if (!/^\d{13,19}$/.test(digits) || !luhnValid(digits)) throw cardError('El número de tarjeta no es válido.');
    const month = Number(expMonth);
    let year = Number(expYear);
    if (year < 100) year += 2000;
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
      throw cardError('La fecha de vencimiento no es válida.');
    }
    if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
      throw cardError('La tarjeta está vencida.');
    }
    if (!/^\d{3,4}$/.test(String(cvc || ''))) throw cardError('El código de seguridad (CVV) no es válido.');
    if (!holder || !String(holder).trim()) throw cardError('Escribe el nombre que aparece en la tarjeta.');

    const behavior = (TEST_CARDS[digits] || { behavior: 'ok' }).behavior;
    const brand = cardBrand(digits);
    return {
      token: `tok_sim_${behavior}_${brand.toLowerCase()}_${digits.slice(-4)}_${randomHex(8)}`,
      brand,
      last4: digits.slice(-4),
      provider: 'simulated'
    };
  }

  const testCards = Object.entries(TEST_CARDS).map(([number, c]) => ({ number: number.replace(/(\d{4})(?=\d)/g, '$1 '), label: c.label }));

  return { name: 'simulated', tokenize, testCards, luhnValid };
});
