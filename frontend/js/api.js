// Client API Module for The Clothes Box Full-Stack v2
window.TCB = window.TCB || {};

TCB.api = (() => {
  const TOKEN_KEY = 'tcb_auth_token';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  async function request(endpoint, options = {}) {
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const config = {
      ...options,
      headers
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const res = await fetch(endpoint, config);
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401 && !endpoint.includes('/api/auth/login')) {
          setToken(null);
          window.location.hash = '#/';
        }
        const error = new Error(data.error || 'Error en la solicitud');
        error.status = res.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  }

  return {
    getToken,
    setToken,
    auth: {
      login: async (email, password) => {
        const data = await request('/api/auth/login', {
          method: 'POST',
          body: { email, password }
        });
        setToken(data.token);
        return data;
      },
      register: async data => {
        const res = await request('/api/auth/register', { method: 'POST', body: data });
        setToken(res.token);
        return res;
      },
      forgot: email => request('/api/auth/forgot', { method: 'POST', body: { email } }),
      reset: (token, password) => request('/api/auth/reset', { method: 'POST', body: { token, password } }),
      verifyEmail: token => request('/api/auth/verify-email', { method: 'POST', body: { token } }),
      resendVerification: () => request('/api/auth/resend-verification', { method: 'POST' }),
      me: () => request('/api/auth/me'),
      // Revoca el token en el servidor (todas las sesiones) y lo borra del navegador.
      logout: async () => {
        if (getToken()) {
          try {
            await request('/api/auth/logout', { method: 'POST' });
          } catch (e) {
            // La sesión ya no era válida: basta con borrar el token local.
          }
        }
        setToken(null);
      }
    },
    products: {
      list: () => request('/api/products')
    },
    account: {
      update: data => request('/api/account', { method: 'PUT', body: data }),
      remove: password => request('/api/account/delete', { method: 'POST', body: { password } }),
      exportData: () => request('/api/profile/export')
    },
    policy: () => request('/api/policy'),
    config: () => request('/api/config'),
    payments: {
      tokenize: card => request('/api/payments/tokenize', { method: 'POST', body: { card } })
    },
    subscription: {
      get: () => request('/api/subscription'),
      subscribe: data => request('/api/subscription/subscribe', { method: 'POST', body: data }),
      pause: () => request('/api/subscription/pause', { method: 'POST' }),
      resume: () => request('/api/subscription/resume', { method: 'POST' }),
      changePlan: plan => request('/api/subscription/change-plan', { method: 'POST', body: { plan } }),
      updatePaymentMethod: paymentToken => request('/api/subscription/payment-method', { method: 'POST', body: { paymentToken } }),
      cancel: data => request('/api/subscription/cancel', { method: 'POST', body: data })
    },
    profile: {
      get: () => request('/api/profile'),
      save: data => request('/api/profile', { method: 'PUT', body: data }),
      history: () => request('/api/profile/history'),
      saveFiscal: data => request('/api/profile/fiscal', { method: 'PUT', body: data })
    },
    quiz: {
      progress: () => request('/api/quiz/progress'),
      saveProgress: data => request('/api/quiz/progress', { method: 'PUT', body: data })
    },
    stylist: {
      queue: () => request('/api/stylist/queue'),
      alternatives: boxId => request(`/api/stylist/boxes/${boxId}/alternatives`),
      approve: (boxId, reason) => request(`/api/stylist/boxes/${boxId}/approve`, { method: 'POST', body: { reason } }),
      replace: (boxId, data) => request(`/api/stylist/boxes/${boxId}/replace`, { method: 'POST', body: data }),
      reject: (boxId, reason) => request(`/api/stylist/boxes/${boxId}/reject`, { method: 'POST', body: { reason } })
    },
    boxes: {
      current: () => request('/api/boxes/current'),
      simulateStep: () => request('/api/boxes/simulate-step', { method: 'POST' }),
      unbox: boxId => request(`/api/boxes/${boxId}/unbox`, { method: 'POST' }),
      rate: (boxId, ratings) => request(`/api/boxes/${boxId}/ratings`, { method: 'POST', body: { ratings } }),
      itemFeedback: (boxId, data) => request(`/api/boxes/${boxId}/item-feedback`, { method: 'POST', body: data }),
      history: () => request('/api/boxes/history'),
      next: () => request('/api/boxes/next', { method: 'POST' })
    },
    returns: {
      get: () => request('/api/returns'),
      create: data => request('/api/returns', { method: 'POST', body: data })
    },
    admin: {
      metrics: () => request('/api/admin/metrics'),
      clients: () => request('/api/admin/clients'),
      products: () => request('/api/admin/products'),
      saveProduct: data => request('/api/admin/products', { method: 'POST', body: data }),
      importProducts: csv => request('/api/admin/products/import', { method: 'POST', body: { csv } }),
      importCatalogCsv: csv => request('/api/admin/catalog/import', { method: 'POST', body: csv, headers: { 'Content-Type': 'text/csv; charset=utf-8' } }),
      updateProduct: (productId, data) => request(`/api/admin/products/${productId}`, { method: 'PUT', body: data }),
      deleteProduct: productId => request(`/api/admin/products/${productId}`, { method: 'DELETE' }),
      restoreProduct: productId => request(`/api/admin/products/${productId}/restore`, { method: 'POST' }),
      catalogVocab: () => request('/api/admin/catalog/vocab'),
      generateBatch: () => request('/api/admin/boxes/generate-batch', { method: 'POST' }),
      boxes: () => request('/api/admin/boxes'),
      updateBoxStatus: (boxId, status) => request(`/api/admin/boxes/${boxId}/status`, { method: 'POST', body: { status } }),
      returns: () => request('/api/admin/returns'),
      updateReturn: (returnId, data) => request(`/api/admin/returns/${returnId}`, { method: 'PUT', body: data }),
      feedback: () => request('/api/admin/feedback'),
      outbox: () => request('/api/admin/outbox'),
      runReviewReminders: () => request('/api/admin/jobs/review-reminders', { method: 'POST' }),
      cancellationReasons: () => request('/api/admin/cancellation-reasons'),
      payments: () => request('/api/admin/payments'),
      runBilling: now => request('/api/admin/jobs/recurring-billing', { method: 'POST', body: { now } }),
      invoices: () => request('/api/admin/invoices'),
      dispatch: () => request('/api/admin/dispatch'),
      dataRequests: () => request('/api/admin/data-requests'),
      ingestFeedback: () => request('/api/admin/jobs/ingest-feedback', { method: 'POST' }),
      kpis: ({ month, plan } = {}) => request(`/api/admin/kpis?${new URLSearchParams({ ...(month ? { month } : {}), ...(plan ? { plan } : {}) })}`),
      setChurnThreshold: value => request('/api/admin/settings/churn-threshold', { method: 'PUT', body: { value } }),
      inventoryMovements: () => request('/api/admin/inventory-movements'),
      runInvoiceRetries: now => request('/api/admin/jobs/invoice-retries', { method: 'POST', body: { now } })
    }
  };
})();

