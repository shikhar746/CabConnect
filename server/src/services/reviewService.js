const { Ride, Review, User } = require('../models');
const { ApiError } = require('../utils/http');
const { round } = require('../utils/geo');
const notifications = require('./notificationService');

async function rateRide(rideId, rider, { rating, comment, tags }) {
  const ride = await Ride.findOne({ _id: rideId, rider: rider._id });
  if (!ride) throw ApiError.notFound('Ride not found');
  if (ride.status !== 'completed' || !ride.driver) throw ApiError.badRequest('You can only rate completed rides');
  if (ride.rated) throw ApiError.conflict('You have already rated this ride');

  const review = await Review.create({ ride: ride._id, rider: rider._id, driver: ride.driver, rating, comment, tags });
  ride.rated = true;
  await ride.save();

  // Incremental running average.
  const driver = await User.findById(ride.driver);
  const count = (driver.driver.ratingCount || 0) + 1;
  driver.driver.rating = round(((driver.driver.rating || 0) * (count - 1) + rating) / count, 2);
  driver.driver.ratingCount = count;
  await driver.save();

  await notifications.notify(ride.driver, { type: 'ride', title: `New ${rating}★ rating`, body: comment ? `“${comment}”` : 'A rider rated your trip.', ride: ride._id, link: '/driver/reviews' });
  return review;
}

module.exports = { rateRide };
