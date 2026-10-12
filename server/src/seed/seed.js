/* eslint-disable no-await-in-loop */
const crypto = require('crypto');
const mongoose = require('mongoose');
const { User, Ride, Payment, Review, PromoCode, SupportTicket, SosAlert, Notification, MessageLog, Payout } = require('../models');
const { computeFare } = require('../services/fareService');
const maps = require('../services/maps/mockMapsProvider');
const places = require('../services/maps/places');
const env = require('../config/env');
const { round } = require('../utils/geo');

const PASSWORD = 'Password@123';

// Deterministic PRNG so every seed produces the same demo dataset.
let s = 42;
const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (a, b) => a + Math.floor(rand() * (b - a + 1));

const RIDERS = [
  { name: 'Aarav Sharma', email: 'rider@cabconnect.dev', phone: '9876500001' },
  { name: 'Priya Nair', email: 'priya@cabconnect.dev', phone: '9876500002' },
  { name: 'Rohan Mehta', email: 'rohan@cabconnect.dev', phone: '9876500003' },
  { name: 'Ananya Iyer', email: 'ananya@cabconnect.dev', phone: '9876500004' },
  { name: 'Kabir Singh', email: 'kabir@cabconnect.dev', phone: '9876500005' },
  { name: 'Meera Reddy', email: 'meera@cabconnect.dev', phone: '9876500006' },
];

// Drivers are spread around central Bengaluru; the first of each type is online.
const DRIVERS = [
  { name: 'Ramesh Kumar', email: 'driver@cabconnect.dev', phone: '9876510001', v: { type: 'mini', make: 'Maruti Suzuki', model: 'Swift', color: 'White', plate: 'KA01AB1234' }, at: [12.9720, 77.6000], online: true },
  { name: 'Suresh Gowda', email: 'suresh@cabconnect.dev', phone: '9876510002', v: { type: 'sedan', make: 'Honda', model: 'City', color: 'Silver', plate: 'KA03MN4567' }, at: [12.9650, 77.6100], online: true },
  { name: 'Imran Khan', email: 'imran@cabconnect.dev', phone: '9876510003', v: { type: 'suv', make: 'Toyota', model: 'Innova Crysta', color: 'Grey', plate: 'KA05CD7890' }, at: [12.9800, 77.5950], online: true },
  { name: 'Venkatesh Rao', email: 'venkatesh@cabconnect.dev', phone: '9876510004', v: { type: 'auto', make: 'Bajaj', model: 'RE Compact', color: 'Green', plate: 'KA02F3344' }, at: [12.9700, 77.6080], online: true },
  { name: 'Arjun Das', email: 'arjun@cabconnect.dev', phone: '9876510005', v: { type: 'bike', make: 'Honda', model: 'Shine', color: 'Black', plate: 'KA04HJ2211' }, at: [12.9740, 77.6030], online: true },
  { name: 'Lakshmi Prasad', email: 'lakshmi@cabconnect.dev', phone: '9876510006', v: { type: 'mini', make: 'Hyundai', model: 'i20', color: 'Red', plate: 'KA51XY9087' }, at: [12.9352, 77.6245], online: true },
  { name: 'Mohammed Faiz', email: 'faiz@cabconnect.dev', phone: '9876510007', v: { type: 'sedan', make: 'Maruti Suzuki', model: 'Dzire', color: 'Blue', plate: 'KA53PQ1122' }, at: [12.9719, 77.6412], online: false },
  { name: 'Deepak Shetty', email: 'deepak@cabconnect.dev', phone: '9876510008', v: { type: 'mini', make: 'Tata', model: 'Tiago', color: 'Orange', plate: 'KA01MM5566' }, at: [12.9857, 77.7366], online: false },
  { name: 'Naveen Joshi', email: 'naveen@cabconnect.dev', phone: '9876510009', v: { type: 'suv', make: 'Mahindra', model: 'XUV700', color: 'Black', plate: 'KA02ZZ8080' }, at: [12.9121, 77.6446], online: false },
  { name: 'Kiran Patil', email: 'kiran@cabconnect.dev', phone: '9876510010', v: { type: 'auto', make: 'TVS', model: 'King', color: 'Yellow', plate: 'KA04E7712' }, at: [12.9250, 77.5838], online: false },
];

const REVIEW_TEXT = [
  [5, 'Very polite and drove safely. Car was spotless!', ['Safe driving', 'Clean car']],
  [5, 'Reached on time, great music and AC.', ['On time', 'Great conversation']],
  [4, 'Good ride, slight detour but okay.', ['Smooth ride']],
  [5, 'Helped with my luggage. Highly recommend.', ['Helpful', 'Polite']],
  [3, 'Ride was fine but the car could be cleaner.', []],
  [4, 'Knew the shortcuts, saved time in traffic.', ['Navigation']],
  [5, '', ['Safe driving']],
];

async function seed({ quiet = false } = {}) {
  const log = (...a) => !quiet && console.log(...a);
  await Promise.all([User, Ride, Payment, Review, PromoCode, SupportTicket, SosAlert, Notification, MessageLog, Payout].map((M) => M.deleteMany({})));
  s = 42;

  const admin = await User.create({ name: 'Ops Admin', email: 'admin@cabconnect.dev', phone: '9876599999', password: PASSWORD, role: 'admin' });

  const riders = [];
  for (const [i, r] of RIDERS.entries()) {
    riders.push(await User.create({
      ...r, password: PASSWORD, role: 'rider', walletBalance: [750, 300, 120, 500, 0, 220][i],
      paymentMethods: i === 0 ? [
        { type: 'card', label: 'Personal Visa', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2029, providerToken: 'pm_mock_seed_4242', isDefault: true },
        { type: 'card', label: 'Test decline card', brand: 'visa', last4: '0002', expMonth: 6, expYear: 2028, providerToken: 'pm_mock_seed_0002' },
        { type: 'upi', label: 'GPay', upiId: 'aarav@okaxis' },
      ] : [{ type: 'upi', label: 'UPI', upiId: `${r.email.split('@')[0]}@okicici`, isDefault: true }],
      emergencyContacts: i === 0 ? [{ name: 'Neha Sharma', phone: '9811122233', relation: 'Sister' }, { name: 'Rajiv Sharma', phone: '9811144455', relation: 'Father' }] : [],
    }));
  }

  const drivers = [];
  for (const d of DRIVERS) {
    drivers.push(await User.create({
      name: d.name, email: d.email, phone: d.phone, password: PASSWORD, role: 'driver',
      driver: {
        vehicle: d.v, licenseNumber: `KA${int(10, 99)}2019${int(100000, 999999)}`, isOnline: d.online, isBusy: false,
        location: { type: 'Point', coordinates: [d.at[1], d.at[0]] },
      },
    }));
  }

  await PromoCode.insertMany([
    { code: 'WELCOME50', description: '50% off your first ride (up to ₹100)', discountType: 'percent', value: 50, maxDiscount: 100, perUserLimit: 1, minFare: 0 },
    { code: 'RIDE20', description: '20% off rides above ₹150 (up to ₹60)', discountType: 'percent', value: 20, maxDiscount: 60, minFare: 150, perUserLimit: 5 },
    { code: 'FLAT75', description: 'Flat ₹75 off rides above ₹300', discountType: 'flat', value: 75, minFare: 300, perUserLimit: 3, usageLimit: 500 },
    { code: 'AIRPORT100', description: '₹100 off airport trips above ₹600', discountType: 'flat', value: 100, minFare: 600, perUserLimit: 2, expiresAt: new Date(Date.now() + 30 * 864e5) },
    { code: 'MONSOON', description: 'Expired monsoon offer', discountType: 'percent', value: 30, maxDiscount: 80, isActive: true, expiresAt: new Date(Date.now() - 5 * 864e5) },
  ]);

  // ---- Ride history across the last 14 days ----
  const reviewsByDriver = new Map();
  let rideCount = 0;
  for (let day = 13; day >= 0; day -= 1) {
    const perDay = int(3, 7);
    for (let k = 0; k < perDay; k += 1) {
      const rider = k === 0 && day % 2 === 0 ? riders[0] : pick(riders);
      const driver = pick(drivers);
      const type = driver.driver.vehicle.type;
      let pickup = pick(places.slice(0, 38));
      let dropoff = pick(places.slice(0, 38));
      while (dropoff === pickup) dropoff = pick(places);
      if (type === 'bike' || type === 'auto') {
        // keep two/three-wheeler trips short
        const near = places.filter((p) => Math.abs(p.lat - pickup.lat) < 0.06 && Math.abs(p.lng - pickup.lng) < 0.06 && p !== pickup);
        if (near.length) dropoff = pick(near); else [pickup, dropoff] = [places[1], places[3]];
      }
      const route = await maps.route([pickup, dropoff]);
      const fare = computeFare(type, { distanceKm: route.distanceKm, durationMin: route.durationMin, surge: rand() < 0.2 ? 1.2 : 1 });
      const created = new Date(); created.setDate(created.getDate() - day); created.setHours(int(7, 22), int(0, 59), 0, 0);
      if (created > new Date()) created.setTime(Date.now() - int(30, 300) * 60000);

      const cancelled = rand() < 0.12;
      const method = pick(['cash', 'upi', 'card', 'wallet', 'upi']);
      const accepted = new Date(created.getTime() + int(1, 3) * 60000);
      const started = new Date(accepted.getTime() + int(4, 10) * 60000);
      const completed = new Date(started.getTime() + route.durationMin * 60000);
      const ride = await Ride.create({
        rider: rider._id, driver: driver._id, pickup, dropoff, rideType: type, route: route.path,
        distanceKm: route.distanceKm, durationMin: route.durationMin, fare,
        status: cancelled ? 'cancelled' : 'completed',
        cancelledBy: cancelled ? 'rider' : undefined, cancelReason: cancelled ? 'Change of plans' : undefined,
        paymentMethod: method, paymentStatus: cancelled ? 'not_required' : 'paid', otp: String(int(1000, 9999)),
        driverLocation: { lat: dropoff.lat, lng: dropoff.lng },
        timeline: cancelled ? { requestedAt: created, acceptedAt: accepted, cancelledAt: new Date(accepted.getTime() + 60000) } : { requestedAt: created, acceptedAt: accepted, arrivedAt: started, startedAt: started, completedAt: completed },
        createdAt: created, updatedAt: cancelled ? accepted : completed,
      });
      rideCount += 1;
      if (cancelled) continue;

      const earning = round(fare.total * env.driverEarningShare, 2);
      await Payment.create({
        ride: ride._id, rider: rider._id, driver: driver._id, amount: fare.total, method, status: 'succeeded',
        provider: ['card', 'upi'].includes(method) ? 'mock' : 'internal', providerRef: `seed_${crypto.randomBytes(5).toString('hex')}`,
        driverEarning: earning, platformFee: round(fare.total - earning, 2),
        receiptNumber: `CC-${completed.toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        createdAt: completed, updatedAt: completed,
      });
      driver.driver.totalEarnings += earning;
      if (method !== 'cash') driver.driver.pendingPayout += earning;

      if (rand() < 0.75) {
        const [rating, comment, tags] = pick(REVIEW_TEXT);
        await Review.create({ ride: ride._id, rider: rider._id, driver: driver._id, rating, comment, tags, createdAt: completed });
        ride.rated = true;
        await ride.save();
        const list = reviewsByDriver.get(String(driver._id)) || [];
        list.push(rating);
        reviewsByDriver.set(String(driver._id), list);
      }
    }
  }

  for (const d of drivers) {
    const ratings = reviewsByDriver.get(String(d._id)) || [];
    d.driver.rating = ratings.length ? round(ratings.reduce((a, b) => a + b, 0) / ratings.length, 2) : 0;
    d.driver.ratingCount = ratings.length;
    d.driver.totalEarnings = round(d.driver.totalEarnings, 2);
    d.driver.pendingPayout = round(d.driver.pendingPayout, 2);
    await d.save();
  }
  // A completed payout for the demo driver
  await Payout.create({ driver: drivers[0]._id, amount: 1850, status: 'paid', provider: 'mock', providerRef: 'po_mock_seed01', createdAt: new Date(Date.now() - 7 * 864e5) });

  // ---- Support tickets ----
  const someRide = await Ride.findOne({ rider: riders[0]._id, status: 'completed' }).sort({ createdAt: -1 });
  await SupportTicket.create([
    {
      user: riders[0]._id, ride: someRide?._id, category: 'lost_item', subject: 'Left my umbrella in the cab', status: 'in_progress', priority: 'medium',
      messages: [
        { author: riders[0]._id, authorRole: 'rider', body: 'Hi, I think I left a black umbrella in the back seat on my last trip. Can you help?' },
        { author: admin._id, authorRole: 'admin', body: 'Sorry about that! We have contacted the driver and will update you shortly.' },
      ],
    },
    {
      user: riders[1]._id, category: 'payment', subject: 'Charged twice for one ride', status: 'open', priority: 'high',
      messages: [{ author: riders[1]._id, authorRole: 'rider', body: 'My UPI was debited twice for yesterday evening\'s ride. Please refund the duplicate.' }],
    },
    {
      user: drivers[0]._id, category: 'account', subject: 'Update bank details for payouts', status: 'resolved', priority: 'low',
      messages: [
        { author: drivers[0]._id, authorRole: 'driver', body: 'I changed my bank. How do I update payout details?' },
        { author: admin._id, authorRole: 'admin', body: 'Done – we have updated your payout account. Future payouts will go to the new account.' },
      ],
    },
  ]);

  // ---- A resolved SOS for the admin view ----
  if (someRide) {
    await SosAlert.create({
      user: riders[0]._id, ride: someRide._id, location: { lat: someRide.pickup.lat, lng: someRide.pickup.lng },
      message: 'Driver took an unfamiliar route', contactsNotified: [{ name: 'Neha Sharma', phone: '9811122233', deliveryStatus: 'sent' }],
      emergencyServicesNotified: true, status: 'resolved', resolvedBy: admin._id, resolutionNote: 'Called rider – route was a diversion due to road works. Rider safe.',
    });
  }

  await Notification.insertMany([
    { user: riders[0]._id, type: 'promo', title: 'Weekend offer: 20% off', body: 'Use RIDE20 on rides above ₹150.', link: '/book' },
    { user: riders[0]._id, type: 'support', title: 'Support replied to your ticket', body: 'We have contacted the driver and will update you shortly.', read: false, link: '/support' },
    { user: drivers[0]._id, type: 'system', title: 'Peak hours ahead', body: 'Demand is usually high 5–9 PM near MG Road. Go online to earn more.' },
  ]);

  log(`Seeded: 1 admin, ${riders.length} riders, ${drivers.length} drivers, ${rideCount} rides, 5 promos, 3 tickets.`);
  log(`Demo logins (password "${PASSWORD}"): rider@cabconnect.dev · driver@cabconnect.dev · admin@cabconnect.dev`);
  return { admin, riders, drivers };
}

module.exports = { seed, PASSWORD };

if (require.main === module) {
  // eslint-disable-next-line global-require
  const { connectDB } = require('../config/db');
  (async () => {
    await connectDB();
    await User.syncIndexes();
    await seed();
    await mongoose.disconnect();
  })().catch((e) => { console.error(e); process.exit(1); });
}
