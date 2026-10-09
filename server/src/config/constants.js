/** Ride categories offered to riders. Fares are in INR. */
const RIDE_TYPES = {
  bike: { label: 'Moto', description: 'Quick, affordable bike rides', capacity: 1, baseFare: 20, perKm: 6, perMin: 1, minFare: 30, speedKmh: 28 },
  auto: { label: 'Auto', description: 'Three-wheeler for short trips', capacity: 3, baseFare: 30, perKm: 10, perMin: 1.5, minFare: 45, speedKmh: 24 },
  mini: { label: 'Mini', description: 'Compact hatchbacks', capacity: 4, baseFare: 50, perKm: 13, perMin: 2, minFare: 80, speedKmh: 26 },
  sedan: { label: 'Prime Sedan', description: 'Comfortable sedans with top drivers', capacity: 4, baseFare: 70, perKm: 16, perMin: 2.5, minFare: 110, speedKmh: 26 },
  suv: { label: 'XL SUV', description: 'Spacious SUVs for groups', capacity: 6, baseFare: 100, perKm: 21, perMin: 3, minFare: 160, speedKmh: 25 },
};

const STOP_FEE = 15; // per intermediate stop

const RIDE_STATUS = ['requested', 'accepted', 'arriving', 'in_progress', 'completed', 'cancelled'];
const ACTIVE_RIDE_STATUS = ['requested', 'accepted', 'arriving', 'in_progress'];

const PAYMENT_METHODS = ['card', 'wallet', 'upi', 'cash'];

const TICKET_CATEGORIES = ['payment', 'lost_item', 'driver_behavior', 'ride_issue', 'account', 'safety', 'other'];

module.exports = { RIDE_TYPES, STOP_FEE, RIDE_STATUS, ACTIVE_RIDE_STATUS, PAYMENT_METHODS, TICKET_CATEGORIES };
