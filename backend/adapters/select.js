// Picks the provider of an adapter from its *_PROVIDER variable and checks that it implements
// the adapter's interface (the list of method names every provider must offer). A real
// provider added later only has to implement the same methods and register itself in the
// adapter's PROVIDERS table. "simulated" is the fake used in development and tests.
function selectProvider({ variable, providers, methods }) {
  const name = process.env[variable] || 'simulated';
  const provider = providers[name];
  if (!provider) {
    throw new Error(`${variable} desconocido: ${name}. Disponibles: ${Object.keys(providers).join(', ')}`);
  }
  const missing = methods.filter(m => typeof provider[m] !== 'function');
  if (missing.length > 0) throw new Error(`El proveedor ${name} de ${variable} no implementa: ${missing.join(', ')}`);
  return provider;
}

module.exports = { selectProvider };
