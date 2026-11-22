// Referrals repository (HU-18, SCRUM-110..113): unique referral codes, anti-fraud rules,
// attribution at signup, conversion upon subscription activation, and administrative reporting.
const store = require('./store');
const users = require('./users');
const config = require('../config');
const { newId } = require('../lib/crypto');
const crypto = require('crypto');

function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'REF-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(crypto.randomInt(chars.length));
  }
  return code;
}

function getOrCreateReferralCode(userId) {
  const user = users.findUserById(userId);
  if (!user) return null;
  if (user.referralCode) return user.referralCode;

  store.data.users = store.data.users || [];
  let code;
  let attempts = 0;
  do {
    code = generateReferralCode();
    attempts++;
  } while (store.data.users.some(u => u.referralCode === code) && attempts < 20);

  user.referralCode = code;
  store.save();
  return code;
}

function getReferralLink(code) {
  const base = config.APP_BASE_URL || 'http://localhost:3000';
  return `${base}/#/registro?ref=${encodeURIComponent(code)}`;
}

function validateReferralCode(rawCode, candidate = {}) {
  if (!rawCode || typeof rawCode !== 'string') {
    return { valid: false, error: 'Debes proporcionar un código de referido válido.' };
  }
  const code = rawCode.trim().toUpperCase();
  const referrer = (store.data.users || []).find(u => u.referralCode === code);
  if (!referrer) {
    return { valid: false, error: 'El código de referido no existe o es inválido.' };
  }

  // Anti-fraude: Auto-referido (mismo ID o mismo correo)
  if (candidate.id && candidate.id === referrer.id) {
    return { valid: false, error: 'No puedes usar tu propio código de referido.' };
  }
  if (candidate.email && referrer.email && candidate.email.trim().toLowerCase() === referrer.email.trim().toLowerCase()) {
    return { valid: false, error: 'No puedes referirte a ti mismo con el mismo correo.' };
  }

  // Anti-fraude: Un usuario ya registrado o ya referido previamente
  store.data.referrals = store.data.referrals || [];
  if (candidate.id && store.data.referrals.some(r => r.referredUserId === candidate.id)) {
    return { valid: false, error: 'Ya has utilizado un código de referido anteriormente.' };
  }

  // Anti-fraude: Límite mensual de beneficios para el referente (máximo 5 al mes)
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const conversionsThisMonth = store.data.referrals.filter(r => {
    if (r.referrerUserId !== referrer.id || r.status !== 'CONVERTED' || !r.convertedAt) return false;
    return r.convertedAt.startsWith(currentMonthKey);
  }).length;

  if (conversionsThisMonth >= (config.REFERRAL?.MAX_REFERRALS_PER_MONTH || 5)) {
    return { valid: false, error: 'El referente ha alcanzado el límite máximo mensual de referidos.' };
  }

  return {
    valid: true,
    referrer: { id: referrer.id, name: referrer.name, code },
    discountCOP: config.REFERRAL?.BENEFIT_REFERRED_COP || 20000,
    referrerRewardCOP: config.REFERRAL?.BENEFIT_REFERRER_COP || 20000
  };
}

function recordReferralAtSignup({ referredUserId, referralCode, candidateEmail = null }) {
  const check = validateReferralCode(referralCode, { id: referredUserId, email: candidateEmail });
  if (!check.valid) {
    const err = new Error(check.error);
    err.status = 400;
    throw err;
  }

  store.data.referrals = store.data.referrals || [];
  const referral = {
    id: newId('ref'),
    referralCode: check.referrer.code,
    referrerUserId: check.referrer.id,
    referredUserId,
    status: 'PENDING', // PENDING -> CONVERTED
    discountCOP: check.discountCOP,
    referrerRewardCOP: check.referrerRewardCOP,
    createdAt: new Date().toISOString(),
    convertedAt: null
  };

  store.data.referrals.push(referral);
  store.save();
  return referral;
}

function convertReferral(referredUserId) {
  store.data.referrals = store.data.referrals || [];
  const referral = store.data.referrals.find(r => r.referredUserId === referredUserId && r.status === 'PENDING');
  if (!referral) return null;

  referral.status = 'CONVERTED';
  referral.convertedAt = new Date().toISOString();
  store.save();
  return referral;
}

function getReferralSummary(userId) {
  const code = getOrCreateReferralCode(userId);
  store.data.referrals = store.data.referrals || [];
  const userReferrals = store.data.referrals.filter(r => r.referrerUserId === userId);
  const converted = userReferrals.filter(r => r.status === 'CONVERTED');

  const usersMap = Object.fromEntries((store.data.users || []).map(u => [u.id, u.name]));

  return {
    referralCode: code,
    referralLink: getReferralLink(code),
    benefit: {
      referredCOP: config.REFERRAL?.BENEFIT_REFERRED_COP || 20000,
      referrerCOP: config.REFERRAL?.BENEFIT_REFERRER_COP || 20000
    },
    stats: {
      totalReferred: userReferrals.length,
      pending: userReferrals.filter(r => r.status === 'PENDING').length,
      converted: converted.length,
      totalRewardsEarnedCOP: converted.reduce((sum, r) => sum + (r.referrerRewardCOP || 20000), 0)
    },
    referrals: userReferrals.map(r => ({
      id: r.id,
      referredUserName: usersMap[r.referredUserId] || 'Usuario The Box',
      status: r.status,
      discountCOP: r.discountCOP,
      createdAt: r.createdAt,
      convertedAt: r.convertedAt
    }))
  };
}

function getAdminReferralsReport() {
  store.data.referrals = store.data.referrals || [];
  const all = store.data.referrals;
  const converted = all.filter(r => r.status === 'CONVERTED');
  const pending = all.filter(r => r.status === 'PENDING');

  const usersMap = Object.fromEntries((store.data.users || []).map(u => [u.id, u]));

  return {
    summary: {
      totalReferrals: all.length,
      pending: pending.length,
      converted: converted.length,
      conversionRatePct: all.length ? Math.round((converted.length / all.length) * 1000) / 10 : 0,
      totalRewardsGrantedCOP: converted.reduce((sum, r) => sum + (r.referrerRewardCOP || 20000), 0)
    },
    referrals: all.map(r => {
      const referrer = usersMap[r.referrerUserId];
      const referred = usersMap[r.referredUserId];
      return {
        id: r.id,
        referralCode: r.referralCode,
        referrerName: referrer ? referrer.name : r.referrerUserId,
        referrerEmail: referrer ? referrer.email : null,
        referredName: referred ? referred.name : r.referredUserId,
        referredEmail: referred ? referred.email : null,
        status: r.status,
        discountCOP: r.discountCOP,
        referrerRewardCOP: r.referrerRewardCOP,
        createdAt: r.createdAt,
        convertedAt: r.convertedAt
      };
    })
  };
}

module.exports = {
  getOrCreateReferralCode,
  getReferralLink,
  validateReferralCode,
  recordReferralAtSignup,
  convertReferral,
  getReferralSummary,
  getAdminReferralsReport
};
