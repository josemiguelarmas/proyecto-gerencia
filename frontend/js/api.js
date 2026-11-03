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
      logout: () => {
        setToken(null);
      }
    },
    products: {
      list: () => request('/api/products')
    },
    policy: () => request('/api/policy'),
    config: () => request('/api/config'),
    subscription: {
      get: () => request('/api/subscription'),
      cancel: data => request('/api/subscription/cancel', { method: 'POST', body: data })
    },
    profile: {
      get: () => request('/api/profile'),
      save: data => request('/api/profile', { method: 'PUT', body: data })
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
      boxes: () => request('/api/admin/boxes'),
      updateBoxStatus: (boxId, status) => request(`/api/admin/boxes/${boxId}/status`, { method: 'POST', body: { status } }),
      returns: () => request('/api/admin/returns'),
      updateReturn: (returnId, data) => request(`/api/admin/returns/${returnId}`, { method: 'PUT', body: data }),
      feedback: () => request('/api/admin/feedback'),
      outbox: () => request('/api/admin/outbox'),
      runReviewReminders: () => request('/api/admin/jobs/review-reminders', { method: 'POST' }),
      cancellationReasons: () => request('/api/admin/cancellation-reasons')
    }
  };
})();

