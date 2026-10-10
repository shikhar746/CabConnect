const { z } = require('zod');
const { RIDE_TYPES, PAYMENT_METHODS, TICKET_CATEGORIES } = require('../config/constants');

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
const phone = z.string().trim().regex(/^\+?[0-9]{10,13}$/, 'Enter a valid phone number (10–13 digits)');
const password = z.string().min(8, 'Password must be at least 8 characters').max(72)
  .regex(/[A-Za-z]/, 'Password must contain a letter').regex(/[0-9]/, 'Password must contain a number');
const name = z.string().trim().min(2, 'Name must be at least 2 characters').max(80);
const email = z.string().trim().toLowerCase().email('Enter a valid email address');

const place = z.object({
  address: z.string().trim().min(3, 'Address is required').max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const vehicle = z.object({
  type: z.enum(Object.keys(RIDE_TYPES)),
  make: z.string().trim().min(2).max(30),
  model: z.string().trim().min(1).max(30),
  color: z.string().trim().min(3).max(20),
  plate: z.string().trim().toUpperCase().regex(/^[A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{0,3}[ -]?[0-9]{1,4}$/, 'Enter a valid registration number, e.g. KA01AB1234'),
});

const auth = {
  register: z.object({
    name, email, phone, password,
    role: z.enum(['rider', 'driver']).default('rider'),
    vehicle: vehicle.optional(),
    licenseNumber: z.string().trim().min(5).max(20).optional(),
  }).refine((d) => d.role !== 'driver' || (d.vehicle && d.licenseNumber), { message: 'Drivers must provide vehicle details and licence number', path: ['vehicle'] }),
  login: z.object({
    identifier: z.string().trim().min(3, 'Enter your email or phone'),
    password: z.string().min(1, 'Password is required'),
  }),
  social: z.object({
    provider: z.enum(['google']),
    idToken: z.string().min(10),
    role: z.enum(['rider', 'driver']).default('rider'),
  }),
  changePassword: z.object({ currentPassword: z.string().min(1), newPassword: password }),
};

const profile = {
  update: z.object({ name: name.optional(), phone: phone.optional() }),
  vehicle: z.object({ vehicle, licenseNumber: z.string().trim().min(5).max(20).optional() }),
  paymentMethod: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('card'),
      cardNumber: z.string().optional(),
      providerToken: z.string().optional(),
      expMonth: z.coerce.number().int().min(1).max(12),
      expYear: z.coerce.number().int().min(2024).max(2050),
      label: z.string().trim().max(60).optional(),
      isDefault: z.boolean().optional(),
    }),
    z.object({
      type: z.literal('upi'),
      upiId: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{2,64}@[a-z]{2,32}$/, 'Enter a valid UPI ID, e.g. name@okaxis'),
      label: z.string().trim().max(60).optional(),
      isDefault: z.boolean().optional(),
    }),
  ]),
  contact: z.object({ name: z.string().trim().min(2).max(60), phone, relation: z.string().trim().max(30).optional() }),
  topUp: z.object({ amount: z.coerce.number().int().min(50, 'Minimum top-up is ₹50').max(10000, 'Maximum top-up is ₹10,000'), paymentMethodId: objectId }),
};

const ride = {
  estimate: z.object({
    pickup: place,
    stops: z.array(place).max(3, 'Maximum 3 stops').default([]),
    dropoff: place,
    promoCode: z.string().trim().toUpperCase().max(20).optional().or(z.literal('').transform(() => undefined)),
  }),
  create: z.object({
    pickup: place,
    stops: z.array(place).max(3, 'Maximum 3 stops').default([]),
    dropoff: place,
    rideType: z.enum(Object.keys(RIDE_TYPES)),
    promoCode: z.string().trim().toUpperCase().max(20).optional().or(z.literal('').transform(() => undefined)),
    paymentMethod: z.enum(PAYMENT_METHODS).default('cash'),
    paymentMethodId: objectId.optional(),
  }),
  cancel: z.object({ reason: z.string().trim().max(200).optional() }),
  start: z.object({ otp: z.string().trim().regex(/^\d{4}$/, 'Enter the 4-digit ride PIN') }),
  pay: z.object({ method: z.enum(PAYMENT_METHODS).optional(), paymentMethodId: objectId.optional() }),
  review: z.object({
    rating: z.coerce.number().int().min(1, 'Rating must be 1–5').max(5, 'Rating must be 1–5'),
    comment: z.string().trim().max(500).optional(),
    tags: z.array(z.string().trim().max(30)).max(6).optional(),
  }),
  sos: z.object({ lat: z.number().optional(), lng: z.number().optional(), message: z.string().trim().max(300).optional() }),
  list: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    status: z.enum(['requested', 'accepted', 'arriving', 'in_progress', 'completed', 'cancelled', 'active']).optional(),
    rideType: z.enum(Object.keys(RIDE_TYPES)).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    q: z.string().trim().max(100).optional(),
    sort: z.enum(['newest', 'oldest', 'fare_high', 'fare_low']).default('newest'),
  }),
};

const driver = {
  status: z.object({ isOnline: z.boolean(), lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional() }),
  location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
};

const support = {
  create: z.object({
    category: z.enum(TICKET_CATEGORIES),
    subject: z.string().trim().min(5, 'Subject must be at least 5 characters').max(120),
    message: z.string().trim().min(10, 'Please describe the issue (10+ characters)').max(2000),
    rideId: objectId.optional(),
  }),
  message: z.object({ body: z.string().trim().min(1, 'Message cannot be empty').max(2000) }),
  update: z.object({ status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(), priority: z.enum(['low', 'medium', 'high']).optional() }),
};

const promo = {
  upsert: z.object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/, 'Code must be 3–20 letters/numbers'),
    description: z.string().trim().max(200).optional(),
    discountType: z.enum(['percent', 'flat']),
    value: z.coerce.number().positive(),
    maxDiscount: z.coerce.number().min(0).optional().nullable(),
    minFare: z.coerce.number().min(0).default(0),
    expiresAt: z.coerce.date().optional().nullable(),
    usageLimit: z.coerce.number().int().min(1).optional().nullable(),
    perUserLimit: z.coerce.number().int().min(1).default(1),
    isActive: z.boolean().default(true),
  }).refine((d) => d.discountType !== 'percent' || d.value <= 100, { message: 'Percent discount cannot exceed 100', path: ['value'] }),
  validate: z.object({ code: z.string().trim().min(1), subtotal: z.coerce.number().min(0) }),
};

const admin = {
  userUpdate: z.object({ isActive: z.boolean() }),
  sos: z.object({ status: z.enum(['acknowledged', 'resolved']), resolutionNote: z.string().trim().max(300).optional() }),
};

module.exports = { objectId, auth, profile, ride, driver, support, promo, admin };
