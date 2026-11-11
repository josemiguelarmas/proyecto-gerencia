// Tiny API router. Each domain module exports a table of { method, path, handler } entries,
// where path is an exact string or a RegExp and `public: true` skips authentication. The
// dispatcher answers CORS preflights, tries public routes, then authenticates, applies the
// role guard of the /api/stylist/ and /api/admin/ prefixes, and runs the first matching
// handler with { req, res, authUser, match }. Unknown endpoints and thrown errors get the
// same JSON answers the original single-file router produced.
const { authenticateRequest } = require('../auth');
const { sendJson, sendPreflight, applyCors } = require('../lib/http');

const routes = [
  require('./config'),
  require('./auth'),
  require('./catalog'),
  require('./profile'),
  require('./quiz'),
  require('./privacy'),
  require('./stylist'),
  require('./boxes'),
  require('./ratings'),
  require('./returns'),
  require('./warehouse'),
  require('./subscription'),
  require('./payments'),
  require('./admin')
].flat();

const publicRoutes = routes.filter(route => route.public);
const privateRoutes = routes.filter(route => !route.public);

const GUARDED_PREFIXES = [
  {
    prefix: '/api/stylist/',
    roles: ['STYLIST', 'ADMIN'],
    forbidden: 'Acceso denegado: se requiere rol de Estilista.',
    notFound: (method, pathname) => `Endpoint de estilista no encontrado: ${method} ${pathname}`
  },
  {
    prefix: '/api/admin/',
    roles: ['ADMIN'],
    forbidden: 'Acceso denegado: se requiere rol de Administrador para gestionar esta sección.',
    notFound: (method, pathname) => `Endpoint administrativo no encontrado: ${method} ${pathname}`
  }
];

function matchRoute(table, method, pathname) {
  for (const route of table) {
    if (route.method !== method) continue;
    const match = typeof route.path === 'string'
      ? (route.path === pathname ? [pathname] : null)
      : pathname.match(route.path);
    if (match) return { route, match };
  }
  return null;
}

async function handleApiRequest(req, res, pathname) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return sendPreflight(res);

  try {
    const publicHit = matchRoute(publicRoutes, req.method, pathname);
    if (publicHit) return await publicHit.route.handler({ req, res, match: publicHit.match });

    const authUser = authenticateRequest(req);
    if (!authUser) {
      return sendJson(res, 401, { error: 'Acceso no autorizado. Inicia sesión para continuar.' });
    }

    const guard = GUARDED_PREFIXES.find(g => pathname.startsWith(g.prefix));
    if (guard && !guard.roles.includes(authUser.role)) {
      return sendJson(res, 403, { error: guard.forbidden });
    }

    const hit = matchRoute(privateRoutes, req.method, pathname);
    if (hit) return await hit.route.handler({ req, res, authUser, match: hit.match });

    const notFound = guard ? guard.notFound(req.method, pathname) : `Endpoint ${req.method} ${pathname} no encontrado.`;
    return sendJson(res, 404, { error: notFound });
  } catch (error) {
    if (error.status) {
      return sendJson(res, error.status, { error: error.message, ...(typeof error.code === 'string' ? { code: error.code } : {}) });
    }
    console.error('API Error:', error);
    return sendJson(res, 500, { error: error.message || 'Error interno del servidor.' });
  }
}

module.exports = { handleApiRequest };
