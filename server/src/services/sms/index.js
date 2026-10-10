const crypto = require('crypto');
const axios = require('axios');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const { MessageLog } = require('../../models');

/**
 * SMS adapter used for SOS alerts. SMS_PROVIDER=mock (default) records the
 * message in MessageLog; SMS_PROVIDER=twilio sends via Twilio's REST API.
 */
async function sendSms({ to, body }) {
  const log = { channel: 'sms', provider: env.smsProvider, to, body };
  try {
    if (env.smsProvider === 'twilio') {
      const { accountSid, authToken, from } = env.twilio;
      const { data } = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        new URLSearchParams({ To: to, From: from, Body: body }),
        { auth: { username: accountSid, password: authToken }, timeout: 8000 },
      );
      log.providerRef = data.sid;
    } else {
      log.providerRef = `sms_mock_${crypto.randomBytes(6).toString('hex')}`;
      logger.info(`[mock-sms] to=${to} body="${body.slice(0, 80)}..."`);
    }
    await MessageLog.create(log);
    return { status: 'sent', providerRef: log.providerRef };
  } catch (e) {
    logger.error('SMS send failed', e.message);
    await MessageLog.create({ ...log, status: 'failed', error: e.message });
    return { status: 'failed', error: e.message };
  }
}

module.exports = { sendSms };
