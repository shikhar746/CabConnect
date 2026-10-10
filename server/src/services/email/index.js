const crypto = require('crypto');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const { MessageLog } = require('../../models');

/**
 * Email adapter. EMAIL_PROVIDER=mock (default) records the email in the
 * MessageLog collection (visible in Admin → Outbox) instead of sending it.
 * EMAIL_PROVIDER=smtp sends through nodemailer using SMTP_* settings.
 */
let transporter;
const smtp = () => {
  if (!transporter) {
    // eslint-disable-next-line global-require
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: env.smtp.host, port: env.smtp.port, secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
};

async function sendEmail({ to, subject, html, text, attachments }) {
  const log = { channel: 'email', provider: env.emailProvider, to, subject, body: text || html };
  try {
    if (env.emailProvider === 'smtp') {
      const info = await smtp().sendMail({ from: env.smtp.from, to, subject, html, text, attachments });
      log.providerRef = info.messageId;
    } else {
      log.providerRef = `email_mock_${crypto.randomBytes(6).toString('hex')}`;
      logger.info(`[mock-email] to=${to} subject="${subject}"${attachments?.length ? ` (+${attachments.length} attachment)` : ''}`);
    }
    await MessageLog.create(log);
    return { status: 'sent', providerRef: log.providerRef };
  } catch (e) {
    logger.error('Email send failed', e.message);
    await MessageLog.create({ ...log, status: 'failed', error: e.message });
    return { status: 'failed', error: e.message };
  }
}

module.exports = { sendEmail };
