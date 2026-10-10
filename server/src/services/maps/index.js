const env = require('../../config/env');

const providers = {
  mock: () => require('./mockMapsProvider'),
  google: () => require('./googleMapsProvider'),
};

if (!providers[env.mapsProvider]) throw new Error(`Unknown MAPS_PROVIDER "${env.mapsProvider}"`);

module.exports = providers[env.mapsProvider]();
