/**
 * Resource manifest for the Venti API.
 *
 * This mirrors the public Venti API reference (https://docs.ventipay.com/).
 * Each action maps to a single `METHOD /path` endpoint. **When an endpoint is
 * added or changed in the API, update this manifest.** The `venti api <method>
 * <path>` escape hatch can reach any endpoint even if it is not mapped here.
 *
 * Each resource declares:
 *   - name:    resource name (command segment)
 *   - group:   logical grouping, used only for help output
 *   - methods: available actions, where each one declares:
 *       - name:   action name (command segment)
 *       - path:   API path; `[0]` is the placeholder for the resource id
 *       - method: HTTP verb
 *       - type:   action signature (see below)
 *
 * Action types and how they map to CLI arguments:
 *   - retrieveOne: <id> [--options]    GET  · options => query params
 *   - retrieveAll:      [--options]    GET  · options => query params
 *   - create:           [--params]     POST · params => body
 *   - update:      <id> [--params]     PUT/POST · params => body
 *   - delete:      <id> [--params]     DELETE   · params => body
 */
module.exports = [
  // ===== Payments =====
  {
    name: 'checkouts',
    group: 'Payments',
    methods: [
      {
        name: 'retrieve', path: 'checkouts/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'list', path: 'checkouts', method: 'get', type: 'retrieveAll',
      },
      {
        name: 'create', path: 'checkouts', method: 'post', type: 'create',
      },
      {
        name: 'refund', path: 'checkouts/[0]/refund', method: 'post', type: 'update',
      },
      {
        name: 'cancel', path: 'checkouts/[0]/cancel', method: 'post', type: 'update',
      },
    ],
  },
  {
    name: 'payments',
    group: 'Payments',
    methods: [
      {
        name: 'retrieve', path: 'payments/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'list', path: 'payments', method: 'get', type: 'retrieveAll',
      },
      {
        name: 'create', path: 'payments', method: 'post', type: 'create',
      },
      {
        name: 'update', path: 'payments/[0]', method: 'put', type: 'update',
      },
      {
        name: 'authorize', path: 'payments/[0]/authorize', method: 'post', type: 'update',
      },
      {
        name: 'capture', path: 'payments/[0]/capture', method: 'post', type: 'update',
      },
      {
        name: 'refund', path: 'payments/[0]/refund', method: 'post', type: 'update',
      },
      {
        name: 'cancel', path: 'payments/[0]/cancel', method: 'post', type: 'update',
      },
    ],
  },
  {
    name: 'refunds',
    group: 'Payments',
    methods: [
      {
        name: 'retrieve', path: 'refunds/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'list', path: 'refunds', method: 'get', type: 'retrieveAll',
      },
    ],
  },
  {
    name: 'payment_buttons',
    group: 'Payments',
    methods: [
      {
        name: 'retrieve', path: 'payment_buttons/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'list', path: 'payment_buttons', method: 'get', type: 'retrieveAll',
      },
      {
        name: 'create', path: 'payment_buttons', method: 'post', type: 'create',
      },
      {
        name: 'update', path: 'payment_buttons/[0]', method: 'put', type: 'update',
      },
    ],
  },
  {
    name: 'coupons',
    group: 'Payments',
    methods: [
      {
        name: 'retrieve', path: 'coupons/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'list', path: 'coupons', method: 'get', type: 'retrieveAll',
      },
      {
        name: 'create', path: 'coupons', method: 'post', type: 'create',
      },
      {
        name: 'update', path: 'coupons/[0]', method: 'put', type: 'update',
      },
    ],
  },

  // ===== Subscriptions =====
  {
    name: 'subscriptions',
    group: 'Subscriptions',
    methods: [
      {
        name: 'retrieve', path: 'subscriptions/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'list', path: 'subscriptions', method: 'get', type: 'retrieveAll',
      },
      {
        name: 'create', path: 'subscriptions', method: 'post', type: 'create',
      },
      {
        name: 'update', path: 'subscriptions/[0]', method: 'put', type: 'update',
      },
      {
        name: 'start', path: 'subscriptions/[0]/start', method: 'post', type: 'update',
      },
      {
        name: 'end', path: 'subscriptions/[0]/end', method: 'post', type: 'update',
      },
      {
        name: 'suspend', path: 'subscriptions/[0]/suspend', method: 'post', type: 'update',
      },
      {
        name: 'unsuspend', path: 'subscriptions/[0]/unsuspend', method: 'post', type: 'update',
      },
    ],
  },
  {
    name: 'invoices',
    group: 'Subscriptions',
    methods: [
      {
        name: 'retrieve', path: 'invoices/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'list', path: 'invoices', method: 'get', type: 'retrieveAll',
      },
      {
        name: 'create', path: 'invoices', method: 'post', type: 'create',
      },
      {
        name: 'update', path: 'invoices/[0]', method: 'put', type: 'update',
      },
      {
        name: 'finalize', path: 'invoices/[0]/finalize', method: 'post', type: 'update',
      },
      {
        name: 'markUncollectible', path: 'invoices/[0]/mark_uncollectible', method: 'post', type: 'update',
      },
      {
        name: 'void', path: 'invoices/[0]/void', method: 'post', type: 'update',
      },
      {
        name: 'pay', path: 'invoices/[0]/authorize', method: 'post', type: 'update',
      },
      {
        name: 'send', path: 'invoices/[0]/send', method: 'post', type: 'update',
      },
    ],
  },
  {
    name: 'plans',
    group: 'Subscriptions',
    methods: [
      {
        name: 'retrieve', path: 'plans/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'list', path: 'plans', method: 'get', type: 'retrieveAll',
      },
      {
        name: 'create', path: 'plans', method: 'post', type: 'create',
      },
      {
        name: 'update', path: 'plans/[0]', method: 'put', type: 'update',
      },
      {
        name: 'subscribe', path: 'plans/[0]/subscription', method: 'post', type: 'update',
      },
    ],
  },
  {
    name: 'products',
    group: 'Subscriptions',
    methods: [
      {
        name: 'retrieve', path: 'products/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'list', path: 'products', method: 'get', type: 'retrieveAll',
      },
      {
        name: 'create', path: 'products', method: 'post', type: 'create',
      },
      {
        name: 'update', path: 'products/[0]', method: 'put', type: 'update',
      },
    ],
  },
  {
    name: 'tax_rates',
    group: 'Subscriptions',
    methods: [
      {
        name: 'retrieve', path: 'tax_rates/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'list', path: 'tax_rates', method: 'get', type: 'retrieveAll',
      },
      {
        name: 'create', path: 'tax_rates', method: 'post', type: 'create',
      },
      {
        name: 'update', path: 'tax_rates/[0]', method: 'put', type: 'update',
      },
    ],
  },

  // ===== Customers =====
  {
    name: 'customers',
    group: 'Customers',
    methods: [
      {
        name: 'retrieve', path: 'customers/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'list', path: 'customers', method: 'get', type: 'retrieveAll',
      },
      {
        name: 'create', path: 'customers', method: 'post', type: 'create',
      },
      {
        name: 'update', path: 'customers/[0]', method: 'put', type: 'update',
      },
      {
        name: 'paymentMethods', path: 'customers/[0]/payment_methods', method: 'get', type: 'retrieveOne',
      },
    ],
  },
  {
    name: 'mandates',
    group: 'Customers',
    methods: [
      {
        name: 'retrieve', path: 'mandates/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'list', path: 'mandates', method: 'get', type: 'retrieveAll',
      },
    ],
  },

  // ===== Payment methods =====
  {
    name: 'payment_methods',
    group: 'Payment methods',
    methods: [
      {
        name: 'retrieve', path: 'payment_methods/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'list', path: 'payment_methods', method: 'get', type: 'retrieveAll',
      },
      {
        name: 'del', path: 'payment_methods/[0]', method: 'delete', type: 'delete',
      },
    ],
  },
  {
    name: 'setup_intents',
    group: 'Payment methods',
    methods: [
      {
        name: 'retrieve', path: 'setup_intents/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'list', path: 'setup_intents', method: 'get', type: 'retrieveAll',
      },
      {
        name: 'create', path: 'setup_intents', method: 'post', type: 'create',
      },
      {
        name: 'update', path: 'setup_intents/[0]', method: 'put', type: 'update',
      },
      {
        name: 'del', path: 'setup_intents/[0]', method: 'delete', type: 'delete',
      },
      {
        name: 'cancel', path: 'setup_intents/[0]/cancel', method: 'post', type: 'update',
      },
    ],
  },

  // ===== Loans =====
  {
    name: 'loans',
    group: 'Loans',
    methods: [
      {
        name: 'retrieve', path: 'loans/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'list', path: 'loans', method: 'get', type: 'retrieveAll',
      },
      {
        name: 'create', path: 'loans', method: 'post', type: 'create',
      },
      {
        name: 'authorize', path: 'loans/[0]/authorize', method: 'post', type: 'update',
      },
      {
        name: 'refund', path: 'loans/[0]/refund', method: 'post', type: 'update',
      },
    ],
  },
  {
    name: 'installments',
    group: 'Loans',
    methods: [
      {
        name: 'retrieve', path: 'installments/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'authorize', path: 'installments/[0]/authorize', method: 'post', type: 'update',
      },
    ],
  },

  // ===== Finance =====
  {
    name: 'balance',
    group: 'Finance',
    methods: [
      {
        name: 'retrieve', path: 'balance', method: 'get', type: 'retrieveAll',
      },
      {
        name: 'overview', path: 'balance/overview', method: 'get', type: 'retrieveAll',
      },
    ],
  },
  {
    name: 'balance_transactions',
    group: 'Finance',
    methods: [
      {
        name: 'retrieve', path: 'balance_transactions/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'list', path: 'balance_transactions', method: 'get', type: 'retrieveAll',
      },
    ],
  },
  {
    name: 'payouts',
    group: 'Finance',
    methods: [
      {
        name: 'retrieve', path: 'payouts/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'list', path: 'payouts', method: 'get', type: 'retrieveAll',
      },
    ],
  },
  {
    name: 'bank_accounts',
    group: 'Finance',
    methods: [
      {
        name: 'retrieve', path: 'bank_accounts/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'list', path: 'bank_accounts', method: 'get', type: 'retrieveAll',
      },
      {
        name: 'create', path: 'bank_accounts', method: 'post', type: 'create',
      },
      {
        name: 'del', path: 'bank_accounts/[0]', method: 'delete', type: 'delete',
      },
    ],
  },

  // ===== Disputes =====
  {
    name: 'disputes',
    group: 'Disputes',
    methods: [
      {
        name: 'retrieve', path: 'disputes/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'list', path: 'disputes', method: 'get', type: 'retrieveAll',
      },
      {
        name: 'upload', path: 'disputes/[0]/upload', method: 'post', type: 'update',
      },
      {
        name: 'confirm', path: 'disputes/[0]/confirm', method: 'post', type: 'update',
      },
    ],
  },

  // ===== Events =====
  {
    name: 'events',
    group: 'Events',
    methods: [
      {
        name: 'retrieve', path: 'events/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'list', path: 'events', method: 'get', type: 'retrieveAll',
      },
    ],
  },

  // ===== Webhooks =====
  {
    name: 'webhooks',
    group: 'Webhooks',
    methods: [
      {
        name: 'retrieve', path: 'webhooks/[0]', method: 'get', type: 'retrieveOne',
      },
      {
        name: 'list', path: 'webhooks', method: 'get', type: 'retrieveAll',
      },
      {
        name: 'create', path: 'webhooks', method: 'post', type: 'create',
      },
      {
        name: 'del', path: 'webhooks/[0]', method: 'delete', type: 'delete',
      },
    ],
  },
  {
    name: 'webhook_attempts',
    group: 'Webhooks',
    methods: [
      {
        name: 'list', path: 'webhook_attempts', method: 'get', type: 'retrieveAll',
      },
    ],
  },

  // ===== Other =====
  {
    name: 'banks',
    group: 'Other',
    methods: [
      {
        name: 'list', path: 'banks', method: 'get', type: 'retrieveAll',
      },
    ],
  },
  {
    name: 'currencies',
    group: 'Other',
    methods: [
      {
        name: 'list', path: 'currencies', method: 'get', type: 'retrieveAll',
      },
    ],
  },
];
