export const money = (n, { decimals = 0 } = {}) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

export const dateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '–');
export const dateOnly = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');
export const shortDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const shortAddress = (a = '') => a.split(',')[0];
export const initials = (name = '') => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
export const titleCase = (s = '') => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const RIDE_STATUS_META = {
  requested: { label: 'Finding driver', color: 'yellow' },
  accepted: { label: 'Driver on the way', color: 'blue' },
  arriving: { label: 'Driver arrived', color: 'purple' },
  in_progress: { label: 'On trip', color: 'brand' },
  completed: { label: 'Completed', color: 'green' },
  cancelled: { label: 'Cancelled', color: 'red' },
};

export const PAYMENT_STATUS_META = {
  pending: { label: 'Payment due', color: 'orange' },
  paid: { label: 'Paid', color: 'gray' },
  failed: { label: 'Payment failed', color: 'red' },
  not_required: { label: 'No charge', color: 'gray' },
};

export const RIDE_TYPE_LABEL = { bike: 'Moto', auto: 'Auto', mini: 'Mini', sedan: 'Prime Sedan', suv: 'XL SUV' };
