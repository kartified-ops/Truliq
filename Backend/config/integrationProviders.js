/**
 * Central provider catalog for Third-party Settings.
 * All listed providers are Admin-configurable. Credentials are stored in the database.
 */
const SERVICE_KEYS = Object.freeze({
  PAYMENT_GATEWAY: 'payment_gateway',
  SMS: 'sms',
  MAPS: 'maps',
  FIREBASE: 'firebase',
  STORAGE: 'storage',
  EMAIL: 'email',
  RECAPTCHA: 'recaptcha',
  KYC: 'kyc',
  NOTIFICATION_CHANNEL: 'notification_channel'
});

const FIELD = (key, label, type = 'text', options = {}) => ({
  key, label, type, ...options
});

const PROVIDER_REGISTRY = Object.freeze({
  [SERVICE_KEYS.PAYMENT_GATEWAY]: {
    label: 'Payment Gateway',
    routeKey: 'payment-gateway',
    providers: {
      razorpay: {
        label: 'Razorpay',
        status: 'active',
        supportsEnvironment: true,
        sensitiveFields: ['testSecretKey', 'liveSecretKey', 'webhookSecret'],
        publicFields: ['testKeyId', 'liveKeyId'],
        fields: [
          FIELD('testKeyId', 'Test Key ID'),
          FIELD('testSecretKey', 'Test Secret Key', 'secret'),
          FIELD('liveKeyId', 'Live Key ID'),
          FIELD('liveSecretKey', 'Live Secret Key', 'secret'),
          FIELD('webhookSecret', 'Webhook Secret', 'secret')
        ]
      },
      cashfree: {
        label: 'Cashfree',
        status: 'active',
        supportsEnvironment: true,
        sensitiveFields: ['secretKey'],
        publicFields: ['appId'],
        fields: [
          FIELD('appId', 'App ID'),
          FIELD('secretKey', 'Secret Key', 'secret')
        ]
      },
      payu: {
        label: 'PayU',
        status: 'active',
        sensitiveFields: ['merchantSalt'],
        publicFields: ['merchantKey'],
        fields: [
          FIELD('merchantKey', 'Merchant Key'),
          FIELD('merchantSalt', 'Merchant Salt', 'secret')
        ]
      },
      stripe: {
        label: 'Stripe',
        status: 'active',
        sensitiveFields: ['secretKey'],
        publicFields: ['publishableKey'],
        fields: [
          FIELD('publishableKey', 'Publishable Key'),
          FIELD('secretKey', 'Secret Key', 'secret')
        ]
      }
    }
  },
  [SERVICE_KEYS.SMS]: {
    label: 'SMS Gateway',
    routeKey: 'sms-gateway',
    providers: {
      sms_india_hub: {
        label: 'SMS India Hub',
        status: 'active',
        sensitiveFields: ['apiKey'],
        publicFields: ['senderId', 'dltTemplateId', 'username', 'apiUrl'],
        fields: [
          FIELD('apiKey', 'API Key', 'secret'),
          FIELD('senderId', 'Sender ID'),
          FIELD('dltTemplateId', 'DLT Template ID'),
          FIELD('username', 'Username'),
          FIELD('apiUrl', 'API URL', 'url')
        ]
      },
      sms_ala: {
        label: 'SMS Ala',
        status: 'active',
        sensitiveFields: ['apiKey'],
        publicFields: ['senderId', 'apiUrl'],
        fields: [
          FIELD('apiKey', 'API Key', 'secret'),
          FIELD('senderId', 'Sender ID'),
          FIELD('apiUrl', 'API URL', 'url')
        ]
      },
      miolo: {
        label: 'Miolo',
        status: 'active',
        sensitiveFields: ['apiKey'],
        publicFields: ['senderId', 'apiUrl'],
        fields: [
          FIELD('apiKey', 'API Key', 'secret'),
          FIELD('senderId', 'Sender ID'),
          FIELD('apiUrl', 'API URL', 'url')
        ]
      },
      twilio: {
        label: 'Twilio',
        status: 'active',
        sensitiveFields: ['authToken'],
        publicFields: ['accountSid', 'phoneNumber'],
        fields: [
          FIELD('accountSid', 'Account SID'),
          FIELD('authToken', 'Auth Token', 'secret'),
          FIELD('phoneNumber', 'Phone Number')
        ]
      }
    }
  },
  [SERVICE_KEYS.MAPS]: {
    label: 'Map & Map APIs',
    routeKey: 'maps',
    providers: {
      google_maps: {
        label: 'Google Maps',
        status: 'active',
        sensitiveFields: ['apiKey'],
        publicFields: ['mapId'],
        fields: [
          FIELD('apiKey', 'API Key', 'secret'),
          FIELD('mapId', 'Map ID')
        ]
      },
      mapbox: {
        label: 'Mapbox',
        status: 'active',
        sensitiveFields: ['accessToken'],
        publicFields: [],
        fields: [FIELD('accessToken', 'Access Token', 'secret')]
      },
      here_maps: {
        label: 'HERE Maps',
        status: 'active',
        sensitiveFields: ['apiKey'],
        publicFields: [],
        fields: [FIELD('apiKey', 'API Key', 'secret')]
      },
      openstreetmap: {
        label: 'OpenStreetMap',
        status: 'active',
        sensitiveFields: [],
        publicFields: ['tileUrl'],
        fields: [FIELD('tileUrl', 'Tile Server URL', 'url')]
      }
    }
  },
  [SERVICE_KEYS.FIREBASE]: {
    label: 'Firebase',
    routeKey: 'firebase',
    providers: {
      firebase_fcm: {
        label: 'Firebase FCM',
        status: 'active',
        sensitiveFields: ['serviceAccountJson'],
        publicFields: ['databaseUrl', 'projectId'],
        fields: [
          FIELD('databaseUrl', 'Database URL', 'url'),
          FIELD('projectId', 'Project ID'),
          FIELD('serviceAccountJson', 'Service Account JSON', 'json')
        ]
      },
      onesignal: {
        label: 'OneSignal',
        status: 'active',
        sensitiveFields: ['restApiKey'],
        publicFields: ['appId'],
        fields: [
          FIELD('appId', 'App ID'),
          FIELD('restApiKey', 'REST API Key', 'secret')
        ]
      },
      aws_sns: {
        label: 'AWS SNS',
        status: 'active',
        sensitiveFields: ['secretAccessKey'],
        publicFields: ['accessKeyId', 'region', 'topicArn'],
        fields: [
          FIELD('accessKeyId', 'Access Key ID'),
          FIELD('secretAccessKey', 'Secret Access Key', 'secret'),
          FIELD('region', 'Region'),
          FIELD('topicArn', 'Topic ARN')
        ]
      }
    }
  },
  [SERVICE_KEYS.STORAGE]: {
    label: 'Media Storage',
    routeKey: 'storage',
    providers: {
      cloudinary: {
        label: 'Cloudinary',
        status: 'active',
        sensitiveFields: ['apiSecret'],
        publicFields: ['cloudName', 'apiKey', 'defaultFolder'],
        fields: [
          FIELD('cloudName', 'Cloud Name'),
          FIELD('apiKey', 'API Key'),
          FIELD('apiSecret', 'API Secret', 'secret'),
          FIELD('defaultFolder', 'Default Folder')
        ]
      },
      aws_s3: {
        label: 'AWS S3',
        status: 'active',
        sensitiveFields: ['secretAccessKey'],
        publicFields: ['accessKeyId', 'bucket', 'region'],
        fields: [
          FIELD('accessKeyId', 'Access Key ID'),
          FIELD('secretAccessKey', 'Secret Access Key', 'secret'),
          FIELD('bucket', 'Bucket'),
          FIELD('region', 'Region')
        ]
      },
      firebase_storage: {
        label: 'Firebase Storage',
        status: 'active',
        sensitiveFields: ['serviceAccountJson'],
        publicFields: ['bucket'],
        fields: [
          FIELD('bucket', 'Storage Bucket'),
          FIELD('serviceAccountJson', 'Service Account JSON', 'json')
        ]
      }
    }
  },
  [SERVICE_KEYS.EMAIL]: {
    label: 'Mail Configuration',
    routeKey: 'mail',
    providers: {
      smtp: {
        label: 'SMTP',
        status: 'active',
        sensitiveFields: ['password'],
        publicFields: ['host', 'port', 'user', 'from', 'fromName', 'encryption'],
        fields: [
          FIELD('host', 'SMTP Host'),
          FIELD('port', 'SMTP Port', 'number'),
          FIELD('user', 'Username'),
          FIELD('password', 'Password', 'secret'),
          FIELD('encryption', 'Encryption', 'select', { options: ['tls', 'ssl', 'none'] }),
          FIELD('from', 'From Email'),
          FIELD('fromName', 'From Name')
        ]
      },
      sendgrid: {
        label: 'SendGrid',
        status: 'active',
        sensitiveFields: ['apiKey'],
        publicFields: ['from'],
        fields: [
          FIELD('apiKey', 'API Key', 'secret'),
          FIELD('from', 'From Email')
        ]
      },
      mailgun: {
        label: 'Mailgun',
        status: 'active',
        sensitiveFields: ['apiKey'],
        publicFields: ['domain', 'from'],
        fields: [
          FIELD('apiKey', 'API Key', 'secret'),
          FIELD('domain', 'Domain'),
          FIELD('from', 'From Email')
        ]
      },
      amazon_ses: {
        label: 'Amazon SES',
        status: 'active',
        sensitiveFields: ['secretAccessKey'],
        publicFields: ['accessKeyId', 'region', 'from'],
        fields: [
          FIELD('accessKeyId', 'Access Key ID'),
          FIELD('secretAccessKey', 'Secret Access Key', 'secret'),
          FIELD('region', 'Region'),
          FIELD('from', 'From Email')
        ]
      }
    }
  },
  [SERVICE_KEYS.RECAPTCHA]: {
    label: 'Recaptcha',
    routeKey: 'recaptcha',
    providers: {
      google_recaptcha: {
        label: 'Google reCAPTCHA',
        status: 'active',
        sensitiveFields: ['secretKey'],
        publicFields: ['siteKey', 'version'],
        fields: [
          FIELD('siteKey', 'Site Key'),
          FIELD('secretKey', 'Secret Key', 'secret'),
          FIELD('version', 'Version', 'select', { options: ['v2', 'v3'] })
        ]
      }
    }
  },
  [SERVICE_KEYS.KYC]: {
    label: 'KYC',
    routeKey: 'kyc',
    providers: {
      digio: {
        label: 'Digio',
        status: 'active',
        sensitiveFields: ['clientSecret'],
        publicFields: ['clientId'],
        fields: [
          FIELD('clientId', 'Client ID'),
          FIELD('clientSecret', 'Client Secret', 'secret')
        ]
      },
      hyperverge: {
        label: 'HyperVerge',
        status: 'active',
        sensitiveFields: ['appKey'],
        publicFields: ['appId'],
        fields: [
          FIELD('appId', 'App ID'),
          FIELD('appKey', 'App Key', 'secret')
        ]
      },
      signzy: {
        label: 'Signzy',
        status: 'active',
        sensitiveFields: ['apiKey'],
        publicFields: ['username'],
        fields: [
          FIELD('username', 'Username'),
          FIELD('apiKey', 'API Key', 'secret')
        ]
      }
    }
  },
  [SERVICE_KEYS.NOTIFICATION_CHANNEL]: {
    label: 'Notification Channel',
    routeKey: 'notification-channel',
    providers: {
      firebase_fcm: {
        label: 'Firebase FCM',
        status: 'active',
        sensitiveFields: ['serviceAccountJson'],
        publicFields: ['databaseUrl', 'projectId'],
        fields: [
          FIELD('databaseUrl', 'Database URL', 'url'),
          FIELD('projectId', 'Project ID'),
          FIELD('serviceAccountJson', 'Service Account JSON', 'json')
        ]
      },
      onesignal: {
        label: 'OneSignal',
        status: 'active',
        sensitiveFields: ['restApiKey'],
        publicFields: ['appId'],
        fields: [
          FIELD('appId', 'App ID'),
          FIELD('restApiKey', 'REST API Key', 'secret')
        ]
      }
    }
  }
});

const getServiceCatalog = (serviceKey) => {
  const service = PROVIDER_REGISTRY[serviceKey];
  if (!service) return null;
  const providers = Object.entries(service.providers).map(([id, meta]) => ({
    id,
    label: meta.label,
    status: meta.status,
    fields: meta.fields,
    supportsEnvironment: !!meta.supportsEnvironment
  }));
  return {
    serviceKey,
    label: service.label,
    routeKey: service.routeKey,
    providers
  };
};

const getAllCatalogs = () => Object.keys(PROVIDER_REGISTRY).map(getServiceCatalog);

const FALLBACK_SENSITIVE = Object.freeze([
  'apiKey', 'apiSecret', 'secretKey', 'password', 'authToken', 'accessToken',
  'bearerToken', 'serviceAccountJson', 'webhookSecret', 'merchantSalt',
  'testSecretKey', 'liveSecretKey', 'restApiKey', 'secretAccessKey', 'appKey', 'clientSecret'
]);

const DEFAULT_CUSTOM_SCHEMA = Object.freeze({
  [SERVICE_KEYS.PAYMENT_GATEWAY]: {
    supportsEnvironment: true,
    sensitiveFields: ['testSecretKey', 'liveSecretKey', 'secretKey'],
    publicFields: ['testKeyId', 'liveKeyId', 'appId'],
    fields: [
      FIELD('testKeyId', 'Test API Key'),
      FIELD('testSecretKey', 'Test Secret Key', 'secret'),
      FIELD('liveKeyId', 'Live API Key'),
      FIELD('liveSecretKey', 'Live Secret Key', 'secret')
    ]
  },
  [SERVICE_KEYS.SMS]: {
    sensitiveFields: ['apiKey', 'authToken'],
    publicFields: ['senderId', 'apiUrl', 'dltTemplateId', 'accountSid', 'phoneNumber'],
    fields: [
      FIELD('apiKey', 'API Key', 'secret'),
      FIELD('senderId', 'Sender ID'),
      FIELD('apiUrl', 'API URL', 'url'),
      FIELD('dltTemplateId', 'Template ID')
    ]
  },
  [SERVICE_KEYS.MAPS]: {
    sensitiveFields: ['apiKey', 'accessToken'],
    publicFields: ['mapId'],
    fields: [FIELD('apiKey', 'API Key', 'secret')]
  },
  [SERVICE_KEYS.FIREBASE]: {
    sensitiveFields: ['serviceAccountJson', 'restApiKey'],
    publicFields: ['databaseUrl', 'projectId', 'appId'],
    fields: [
      FIELD('databaseUrl', 'Database URL', 'url'),
      FIELD('projectId', 'Project ID'),
      FIELD('serviceAccountJson', 'Service Account JSON', 'json')
    ]
  },
  [SERVICE_KEYS.STORAGE]: {
    sensitiveFields: ['apiSecret', 'secretAccessKey'],
    publicFields: ['cloudName', 'apiKey', 'defaultFolder', 'bucket', 'region'],
    fields: [
      FIELD('cloudName', 'Cloud Name'),
      FIELD('apiKey', 'API Key'),
      FIELD('apiSecret', 'API Secret', 'secret')
    ]
  },
  [SERVICE_KEYS.EMAIL]: {
    sensitiveFields: ['password', 'apiKey'],
    publicFields: ['host', 'port', 'user', 'from', 'fromName', 'encryption'],
    fields: [
      FIELD('host', 'SMTP Host'),
      FIELD('port', 'SMTP Port', 'number'),
      FIELD('user', 'Username'),
      FIELD('password', 'Password', 'secret'),
      FIELD('from', 'From Email'),
      FIELD('fromName', 'From Name')
    ]
  },
  [SERVICE_KEYS.RECAPTCHA]: {
    sensitiveFields: ['secretKey'],
    publicFields: ['siteKey', 'version'],
    fields: [
      FIELD('siteKey', 'Site Key'),
      FIELD('secretKey', 'Secret Key', 'secret')
    ]
  },
  [SERVICE_KEYS.KYC]: {
    sensitiveFields: ['clientSecret', 'appKey', 'apiKey'],
    publicFields: ['clientId', 'appId', 'username'],
    fields: [
      FIELD('clientId', 'Client ID'),
      FIELD('clientSecret', 'Client Secret', 'secret')
    ]
  },
  [SERVICE_KEYS.NOTIFICATION_CHANNEL]: {
    sensitiveFields: ['serviceAccountJson', 'restApiKey'],
    publicFields: ['databaseUrl', 'projectId', 'appId'],
    fields: [
      FIELD('appId', 'App ID'),
      FIELD('restApiKey', 'REST API Key', 'secret')
    ]
  }
});

const getDefaultCustomSchema = (serviceKey) => DEFAULT_CUSTOM_SCHEMA[serviceKey] || DEFAULT_CUSTOM_SCHEMA[SERVICE_KEYS.SMS];

const getProviderMeta = (serviceKey, providerId) => {
  const service = PROVIDER_REGISTRY[serviceKey];
  if (!service) return null;
  if (service.providers[providerId]) return service.providers[providerId];
  const defaults = getDefaultCustomSchema(serviceKey);
  if (providerId && /^[a-z0-9_]{2,60}$/.test(providerId)) {
    return {
      label: providerId,
      status: 'active',
      custom: true,
      ...defaults
    };
  }
  return null;
};

const getActiveProviders = (serviceKey) => {
  const catalog = getServiceCatalog(serviceKey);
  if (!catalog) return [];
  return catalog.providers;
};

const assertActiveProvider = (serviceKey, providerId) => {
  const meta = getProviderMeta(serviceKey, providerId);
  if (!meta) throw new Error('Unknown provider.');
  return meta;
};

const getSensitiveFields = (serviceKey, providerId) => {
  const meta = getProviderMeta(serviceKey, providerId);
  const listed = meta?.sensitiveFields;
  if (listed && listed.length) return listed;
  return [...FALLBACK_SENSITIVE];
};

const getPublicFields = (serviceKey, providerId) => {
  const meta = getProviderMeta(serviceKey, providerId);
  if (meta?.publicFields?.length) return meta.publicFields;
  return getDefaultCustomSchema(serviceKey).publicFields || [];
};

// Legacy service name mapping (storage was cloudinary in older code)
const LEGACY_SERVICE_MAP = Object.freeze({
  cloudinary: SERVICE_KEYS.STORAGE,
  firebase: SERVICE_KEYS.FIREBASE
});

const normalizeServiceKey = (key) => LEGACY_SERVICE_MAP[key] || key;

module.exports = {
  SERVICE_KEYS,
  PROVIDER_REGISTRY,
  getServiceCatalog,
  getAllCatalogs,
  getProviderMeta,
  getActiveProviders,
  assertActiveProvider,
  getSensitiveFields,
  getPublicFields,
  getDefaultCustomSchema,
  normalizeServiceKey
};
