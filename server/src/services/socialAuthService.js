const axios = require('axios');
const env = require('../config/env');
const { ApiError } = require('../utils/http');

/**
 * Verifies a social identity token and returns { email, name, picture }.
 *  - mock (default): accepts "mock-google.<base64url JSON {email,name}>" produced by
 *    the demo sign-in dialog. Never enable in production.
 *  - google: verifies a real Google Identity Services ID token and checks the audience.
 */
async function verify(provider, idToken) {
  if (provider !== 'google') throw ApiError.badRequest('Unsupported provider');

  if (env.socialAuthProvider === 'google') {
    if (!env.googleClientId || env.googleClientId.startsWith('REPLACE')) throw new Error('GOOGLE_CLIENT_ID is not configured');
    try {
      const { data } = await axios.get('https://oauth2.googleapis.com/tokeninfo', { params: { id_token: idToken }, timeout: 8000 });
      if (data.aud !== env.googleClientId) throw new Error('aud mismatch');
      if (data.email_verified !== 'true' && data.email_verified !== true) throw new Error('email not verified');
      return { email: data.email, name: data.name || data.email.split('@')[0], picture: data.picture };
    } catch {
      throw ApiError.unauthorized('Google sign-in failed');
    }
  }

  if (!idToken.startsWith('mock-google.')) throw ApiError.unauthorized('Invalid demo Google token');
  try {
    const profile = JSON.parse(Buffer.from(idToken.slice('mock-google.'.length), 'base64url').toString('utf8'));
    if (!/^\S+@\S+\.\S+$/.test(profile.email || '')) throw new Error('bad email');
    return { email: profile.email.toLowerCase(), name: (profile.name || profile.email.split('@')[0]).slice(0, 80), picture: profile.picture };
  } catch {
    throw ApiError.unauthorized('Invalid demo Google token');
  }
}

module.exports = { verify };
