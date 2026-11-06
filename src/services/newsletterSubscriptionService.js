import { logDiagnostic } from '../utils/diagnostics';
import { getAvailableStates, getDistrictsByState } from './locationService';
import { getAllServices } from './serviceCatalog';
import { getNotices } from './noticeDigestService';

const STORAGE_KEY = 'civicbridge_newsletter_subscriptions';
const SENT_DIGESTS_KEY = 'civicbridge_sent_digests';

export const NEWSLETTER_FREQUENCIES = {
  MONTHLY: 'monthly',
  NONE: 'none',
};

export const NEWSLETTER_STATUS = {
  ACTIVE: 'active',
  UNSUBSCRIBED: 'unsubscribed',
  PENDING_VERIFICATION: 'pending_verification',
};

export const TOPIC_CATEGORIES = [
  { id: 'new_services', label: 'New Services Added', description: 'Newly added civic services in the catalogue' },
  { id: 'service_changes', label: 'Service Updates', description: 'Changes to existing services (fees, documents, eligibility, process)' },
  { id: 'deadlines', label: 'Upcoming Deadlines', description: 'Approaching application windows, renewal dates, and submission cutoffs' },
  { id: 'announcements', label: 'Official Announcements', description: 'Verified gazette notifications and government circulars' },
  { id: 'schemes', label: 'Welfare Schemes', description: 'New and updated government welfare schemes and benefits' },
];

export const DEFAULT_TOPICS = TOPIC_CATEGORIES.map((t) => t.id);

const DEFAULT_SUBSCRIPTION = {
  email: '',
  userId: null,
  status: NEWSLETTER_STATUS.PENDING_VERIFICATION,
  frequency: NEWSLETTER_FREQUENCIES.MONTHLY,
  topics: DEFAULT_TOPICS,
  geography: {
    level: 'national',
    states: [],
    districts: [],
  },
  savedServiceIds: [],
  consentGiven: false,
  consentGivenAt: null,
  unsubscribedAt: null,
  createdAt: null,
  updatedAt: null,
  verificationToken: null,
  verificationTokenExpiry: null,
  lastSentAt: null,
  lastSentDigestId: null,
};

const getStorage = (customStorage) => {
  if (customStorage) return customStorage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

const generateToken = () => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
};

export const getSubscriptions = (customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveSubscriptions = (subscriptions, customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
    return true;
  } catch {
    return false;
  }
};

export const getSentDigests = (customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return [];
  try {
    const raw = storage.getItem(SENT_DIGESTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveSentDigests = (digests, customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return false;
  try {
    storage.setItem(SENT_DIGESTS_KEY, JSON.stringify(digests));
    return true;
  } catch {
    return false;
  }
};

export const recordSentDigest = (subscriptionId, digestId, customStorage) => {
  const digests = getSentDigests(customStorage);
  digests.push({
    subscriptionId,
    digestId,
    sentAt: new Date().toISOString(),
  });
  saveSentDigests(digests, customStorage);
};

export const hasDigestBeenSent = (subscriptionId, digestId, customStorage) => {
  const digests = getSentDigests(customStorage);
  return digests.some((d) => d.subscriptionId === subscriptionId && d.digestId === digestId);
};

export const validateSubscriptionInput = (data) => {
  const errors = [];

  if (!data.email || typeof data.email !== 'string' || !data.email.includes('@')) {
    errors.push('A valid email address is required.');
  }

  if (data.consentGiven === false) {
    errors.push('Explicit consent is required to create a subscription.');
  }

  if (data.frequency && !Object.values(NEWSLETTER_FREQUENCIES).includes(data.frequency)) {
    errors.push('Invalid frequency. Must be "monthly" or "none".');
  }

  if (data.topics && Array.isArray(data.topics)) {
    const validTopics = TOPIC_CATEGORIES.map((t) => t.id);
    const invalid = data.topics.filter((t) => !validTopics.includes(t));
    if (invalid.length > 0) {
      errors.push(`Invalid topics: ${invalid.join(', ')}`);
    }
  }

  if (data.geography) {
    const { level, states, districts } = data.geography;
    if (!['national', 'state', 'district'].includes(level)) {
      errors.push('Geography level must be "national", "state", or "district".');
    }
    if (level === 'state' && (!states || !Array.isArray(states) || states.length === 0)) {
      errors.push('At least one state must be selected for state-level geography.');
    }
    if (level === 'district' && (!districts || !Array.isArray(districts) || districts.length === 0)) {
      errors.push('At least one district must be selected for district-level geography.');
    }
    if (states && Array.isArray(states)) {
      const availableStates = getAvailableStates();
      const invalidStates = states.filter((s) => !availableStates.includes(s));
      if (invalidStates.length > 0) {
        errors.push(`Invalid states: ${invalidStates.join(', ')}`);
      }
    }
    if (districts && Array.isArray(districts)) {
      const allDistricts = states
        ? states.flatMap((s) => getDistrictsByState(s))
        : getAvailableStates().flatMap((s) => getDistrictsByState(s));
      const invalidDistricts = districts.filter((d) => !allDistricts.includes(d));
      if (invalidDistricts.length > 0) {
        errors.push(`Invalid districts: ${invalidDistricts.join(', ')}`);
      }
    }
  }

  if (data.savedServiceIds && Array.isArray(data.savedServiceIds)) {
    const allServices = getAllServices({ includeArchived: true }).map((s) => s.id);
    const invalidServices = data.savedServiceIds.filter((id) => !allServices.includes(id));
    if (invalidServices.length > 0) {
      errors.push(`Invalid service IDs: ${invalidServices.join(', ')}`);
    }
  }

  return { isValid: errors.length === 0, errors };
};

export const createSubscription = (input, customStorage) => {
  const validation = validateSubscriptionInput(input);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(' '));
  }

  if (!input.consentGiven) {
    throw new Error('Explicit consent is required to create a subscription.');
  }

  const storage = getStorage(customStorage);
  if (!storage) throw new Error('Storage not available');

  const subscriptions = getSubscriptions(customStorage);
  const existingIndex = subscriptions.findIndex(
    (s) => s.email.toLowerCase() === input.email.toLowerCase()
  );

  const now = new Date().toISOString();
  const verificationToken = generateToken();
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const subscription = {
    ...DEFAULT_SUBSCRIPTION,
    email: input.email.toLowerCase().trim(),
    userId: input.userId || null,
    frequency: input.frequency || NEWSLETTER_FREQUENCIES.MONTHLY,
    topics: input.topics || DEFAULT_TOPICS,
    geography: input.geography || { level: 'national', states: [], districts: [] },
    savedServiceIds: input.savedServiceIds || [],
    consentGiven: true,
    consentGivenAt: now,
    createdAt: now,
    updatedAt: now,
    verificationToken,
    verificationTokenExpiry: tokenExpiry,
    status: NEWSLETTER_STATUS.PENDING_VERIFICATION,
  };

  let savedSubscription;
  if (existingIndex >= 0) {
    savedSubscription = { ...subscriptions[existingIndex], ...subscription, id: subscriptions[existingIndex].id };
    subscriptions[existingIndex] = savedSubscription;
  } else {
    subscription.id = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    savedSubscription = subscription;
    subscriptions.unshift(subscription);
  }

  saveSubscriptions(subscriptions, customStorage);
  logDiagnostic(`Newsletter subscription created: ${savedSubscription.email}`);
  return savedSubscription;
};

export const getSubscriptionById = (id, customStorage) => {
  const subscriptions = getSubscriptions(customStorage);
  return subscriptions.find((s) => s.id === id) || null;
};

export const getSubscriptionByEmail = (email, customStorage) => {
  const subscriptions = getSubscriptions(customStorage);
  return subscriptions.find((s) => s.email.toLowerCase() === email.toLowerCase().trim()) || null;
};

export const getSubscriptionByToken = (token, customStorage) => {
  const subscriptions = getSubscriptions(customStorage);
  return subscriptions.find((s) => s.verificationToken === token) || null;
};

export const verifySubscription = (token, customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) throw new Error('Storage not available');

  const subscriptions = getSubscriptions(customStorage);
  const index = subscriptions.findIndex((s) => s.verificationToken === token);

  if (index === -1) {
    return { valid: false, reason: 'invalid_token', message: 'Invalid or expired verification link.' };
  }

  const subscription = subscriptions[index];

  if (subscription.status === NEWSLETTER_STATUS.ACTIVE) {
    return { valid: true, alreadyVerified: true, subscription };
  }

  if (new Date() > new Date(subscription.verificationTokenExpiry)) {
    return { valid: false, reason: 'expired', message: 'Verification link has expired. Please resubscribe.' };
  }

  subscription.status = NEWSLETTER_STATUS.ACTIVE;
  subscription.verificationTokenUsed = true;
  subscription.updatedAt = new Date().toISOString();

  saveSubscriptions(subscriptions, customStorage);
  logDiagnostic(`Newsletter subscription verified: ${subscription.email}`);
  return { valid: true, subscription };
};

export const updateSubscription = (id, updates, customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) throw new Error('Storage not available');

  const subscriptions = getSubscriptions(customStorage);
  const index = subscriptions.findIndex((s) => s.id === id);

  if (index === -1) {
    throw new Error('Subscription not found.');
  }

  const current = subscriptions[index];

  if (current.status === NEWSLETTER_STATUS.UNSUBSCRIBED) {
    throw new Error('Cannot update an unsubscribed subscription. Please resubscribe.');
  }

  const validation = validateSubscriptionInput({ ...current, ...updates });
  if (!validation.isValid) {
    throw new Error(validation.errors.join(' '));
  }

  const updated = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  subscriptions[index] = updated;
  saveSubscriptions(subscriptions, customStorage);
  logDiagnostic(`Newsletter subscription updated: ${updated.email}`);
  return updated;
};

export const unsubscribe = (identifier, customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) throw new Error('Storage not available');

  const subscriptions = getSubscriptions(customStorage);

  let subscription;
  if (identifier.includes('@')) {
    const index = subscriptions.findIndex((s) => s.email.toLowerCase() === identifier.toLowerCase().trim());
    if (index === -1) throw new Error('Subscription not found.');
    subscription = subscriptions[index];
  } else {
    const index = subscriptions.findIndex((s) => s.id === identifier);
    if (index === -1) throw new Error('Subscription not found.');
    subscription = subscriptions[index];
  }

  subscription.status = NEWSLETTER_STATUS.UNSUBSCRIBED;
  subscription.unsubscribedAt = new Date().toISOString();
  subscription.updatedAt = new Date().toISOString();
  subscription.frequency = NEWSLETTER_FREQUENCIES.NONE;

  saveSubscriptions(subscriptions, customStorage);
  logDiagnostic(`Newsletter unsubscribed: ${subscription.email}`);
  return subscription;
};

export const resubscribe = (email, customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) throw new Error('Storage not available');

  const subscriptions = getSubscriptions(customStorage);
  const index = subscriptions.findIndex((s) => s.email.toLowerCase() === email.toLowerCase().trim());

  if (index === -1) {
    throw new Error('No previous subscription found. Please create a new subscription.');
  }

  const subscription = subscriptions[index];
  if (subscription.status !== NEWSLETTER_STATUS.UNSUBSCRIBED) {
    throw new Error('Subscription is already active.');
  }

  const verificationToken = generateToken();
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  subscription.status = NEWSLETTER_STATUS.PENDING_VERIFICATION;
  subscription.verificationToken = verificationToken;
  subscription.verificationTokenExpiry = tokenExpiry;
  subscription.unsubscribedAt = null;
  subscription.frequency = NEWSLETTER_FREQUENCIES.MONTHLY;
  subscription.updatedAt = new Date().toISOString();

  saveSubscriptions(subscriptions, customStorage);
  logDiagnostic(`Newsletter resubscription initiated: ${subscription.email}`);
  return subscription;
};

export const getActiveSubscriptions = (customStorage) => {
  const subscriptions = getSubscriptions(customStorage);
  return subscriptions.filter((s) => s.status === NEWSLETTER_STATUS.ACTIVE && s.frequency === NEWSLETTER_FREQUENCIES.MONTHLY);
};

export const getSubscriptionsForDigest = (customStorage) => {
  const active = getActiveSubscriptions(customStorage);
  const now = new Date();
  return active.filter((s) => {
    if (!s.lastSentAt) return true;
    const lastSent = new Date(s.lastSentAt);
    const daysSinceLastSent = (now - lastSent) / (1000 * 60 * 60 * 24);
    return daysSinceLastSent >= 28;
  });
};

export const buildDigestContent = (subscription, customStorage) => {
  const notices = getNotices(customStorage);
  const services = getAllServices({ includeArchived: true });
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  const filteredNotices = notices
    .filter((n) => n.status === 'approved')
    .filter((n) => {
      if (subscription.geography.level === 'national') return true;
      if (subscription.geography.level === 'state') {
        return n.affectedServiceIds.some((id) => {
          const svc = serviceMap.get(id);
          return svc && subscription.geography.states.some((state) => {
            if (!svc.jurisdiction) return false;
            if (svc.jurisdiction.level === 'national') return true;
            return svc.jurisdiction.states?.includes(state);
          });
        });
      }
      if (subscription.geography.level === 'district') {
        return n.affectedServiceIds.some((id) => {
          const svc = serviceMap.get(id);
          return svc && subscription.geography.districts.some((district) => {
            if (!svc.jurisdiction) return false;
            if (svc.jurisdiction.level === 'national') return true;
            return svc.jurisdiction.districts?.includes(district);
          });
        });
      }
      return false;
    })
    .filter((n) => {
      if (subscription.topics.includes('announcements')) return true;
      if (subscription.topics.includes('new_services')) {
        return n.category === 'gazette_order' || n.category === 'rule_amendment';
      }
      if (subscription.topics.includes('service_changes')) {
        return ['rule_amendment', 'fee_revision', 'document_requirement', 'office_jurisdiction'].includes(n.category);
      }
      if (subscription.topics.includes('deadlines')) {
        return n.category === 'deadline_extension';
      }
      if (subscription.topics.includes('schemes')) {
        return n.affectedServiceIds.some((id) => {
          const svc = serviceMap.get(id);
          return svc && ['Social Welfare', 'Agriculture', 'Employment'].includes(svc.category);
        });
      }
      return false;
    })
    .filter((n) => !hasDigestBeenSent(subscription.id, n.id, customStorage))
    .sort((a, b) => new Date(b.gazettePublicationDate) - new Date(a.gazettePublicationDate))
    .slice(0, 20);

  const origin = typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:5173';
  return {
    subscriptionId: subscription.id,
    email: subscription.email,
    generatedAt: new Date().toISOString(),
    notices: filteredNotices.map((n) => ({
      id: n.id,
      title: n.title,
      summary: n.summary,
      category: n.category,
      gazettePublicationDate: n.gazettePublicationDate,
      sourceUrl: n.sourceUrl,
      affectedServices: n.affectedServiceIds.map((id) => {
        const svc = serviceMap.get(id);
        return svc ? { id: svc.id, name: svc.name } : { id, name: id };
      }),
    })),
    unsubscribeUrl: `${origin}/newsletter/unsubscribe?email=${encodeURIComponent(subscription.email)}`,
    preferencesUrl: `${origin}/newsletter/preferences?email=${encodeURIComponent(subscription.email)}`,
  };
};

export const markDigestSent = (subscriptionId, digestId, customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return false;

  const subscriptions = getSubscriptions(customStorage);
  const index = subscriptions.findIndex((s) => s.id === subscriptionId);
  if (index === -1) return false;

  subscriptions[index].lastSentAt = new Date().toISOString();
  subscriptions[index].lastSentDigestId = digestId;
  subscriptions[index].updatedAt = new Date().toISOString();
  saveSubscriptions(subscriptions, customStorage);

  recordSentDigest(subscriptionId, digestId, customStorage);
  logDiagnostic(`Newsletter digest sent: ${subscriptionId}`);
  return true;
};

export const generateAdminPreview = (subscriptionId, customStorage) => {
  const subscription = getSubscriptionById(subscriptionId, customStorage);
  if (!subscription) {
    throw new Error('Subscription not found.');
  }
  return buildDigestContent(subscription, customStorage);
};

export const getSubscriptionStats = (customStorage) => {
  const subscriptions = getSubscriptions(customStorage);
  return {
    total: subscriptions.length,
    active: subscriptions.filter((s) => s.status === NEWSLETTER_STATUS.ACTIVE).length,
    pending: subscriptions.filter((s) => s.status === NEWSLETTER_STATUS.PENDING_VERIFICATION).length,
    unsubscribed: subscriptions.filter((s) => s.status === NEWSLETTER_STATUS.UNSUBSCRIBED).length,
    monthly: subscriptions.filter((s) => s.frequency === NEWSLETTER_FREQUENCIES.MONTHLY).length,
  };
};

export const logDeliveryFailure = (subscriptionId, error, customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return;

  try {
    const key = 'civicbridge_newsletter_delivery_failures';
    const raw = storage.getItem(key);
    const failures = raw ? JSON.parse(raw) : [];
    failures.push({
      subscriptionId,
      error: error?.message || String(error),
      timestamp: new Date().toISOString(),
    });
    storage.setItem(key, JSON.stringify(failures.slice(-100)));
  } catch {
    logDiagnostic('Failed to log delivery failure', error);
  }
};

export const getDeliveryFailures = (customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return [];
  try {
    const raw = storage.getItem('civicbridge_newsletter_delivery_failures');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const resetSubscriptionData = (customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return false;
  try {
    storage.removeItem(STORAGE_KEY);
    storage.removeItem(SENT_DIGESTS_KEY);
    storage.removeItem('civicbridge_newsletter_delivery_failures');
    return true;
  } catch {
    return false;
  }
};