// Database facade. Loads the JSON store once (DATA_DIR, seeded from backend/data/seed/ on the
// first boot), makes sure the base demo records exist, and exposes the historical `db` object
// so existing callers keep working: `db.data` and `db.catalog` are the live store state,
// `db.save()` and `db.saveCatalog()` persist it atomically, and every other method comes from
// a repository in backend/repos/. New code may import a repository directly instead.
const store = require('./repos/store');
const bootstrap = require('./repos/bootstrap');
const { hashPassword, verifyPassword, sha256 } = require('./lib/crypto');

store.load(bootstrap.initialData);
if (bootstrap.ensureBaseRecords()) store.save();

const db = {
  get data() { return store.data; },
  get catalog() { return store.catalog; },
  save: store.save,
  saveCatalog: store.saveCatalog,
  ...require('./repos/users'),
  ...require('./repos/consents'),
  ...require('./repos/authTokens'),
  ...require('./repos/profiles'),
  ...require('./repos/quizSessions'),
  ...require('./repos/subscriptions'),
  ...require('./repos/payments'),
  ...require('./repos/invoices'),
  ...require('./repos/dataRequests'),
  ...require('./repos/settings'),
  ...require('./repos/cancellations'),
  ...require('./repos/corrections'),
  ...require('./repos/boxes'),
  ...require('./repos/ratings'),
  ...require('./repos/returns'),
  ...require('./repos/products'),
  ...require('./repos/adminReports')
};

module.exports = {
  db,
  sha256,
  verifyPassword,
  hashPassword
};
