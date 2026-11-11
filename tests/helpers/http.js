// Minimal JSON HTTP client for API tests. Every call returns { status, headers, body },
// where body is parsed JSON when possible and the raw text otherwise.
const http = require('http');

function createClient(baseUrl) {
  const base = new URL(baseUrl);

  function request(method, path, data = null, token = null, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
      const payload = data === null || data === undefined ? null : JSON.stringify(data);
      const req = http.request(
        {
          hostname: base.hostname,
          port: base.port,
          path,
          method,
          agent: false,
          headers: {
            'Content-Type': 'application/json',
            ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...extraHeaders
          }
        },
        res => {
          let text = '';
          res.setEncoding('utf8');
          res.on('data', chunk => (text += chunk));
          res.on('end', () => {
            let body = text;
            try {
              body = JSON.parse(text);
            } catch (e) {
              // Not JSON (CSV, HTML, empty body): keep the raw text.
            }
            resolve({ status: res.statusCode, headers: res.headers, body });
          });
        }
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  return {
    request,
    get: (path, token) => request('GET', path, null, token),
    post: (path, data, token) => request('POST', path, data, token),
    put: (path, data, token) => request('PUT', path, data, token),
    del: (path, token) => request('DELETE', path, null, token)
  };
}

module.exports = { createClient };
