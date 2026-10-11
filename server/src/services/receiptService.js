const PDFDocument = require('pdfkit');
const { RIDE_TYPES } = require('../config/constants');

const money = (n) => `Rs. ${Number(n || 0).toFixed(2)}`; // PDFKit's base fonts lack the ₹ glyph
const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '-');

/** Renders a ride receipt PDF and resolves to a Buffer. */
function buildReceiptPdf(ride, payment) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const brand = '#0F766E';
    doc.rect(0, 0, doc.page.width, 90).fill(brand);
    doc.fillColor('#fff').fontSize(24).font('Helvetica-Bold').text('CabConnect', 50, 30);
    doc.fontSize(10).font('Helvetica').text('Ride receipt', 50, 60);
    doc.fontSize(10).text(`Receipt # ${payment?.receiptNumber || `R-${String(ride._id).slice(-8).toUpperCase()}`}`, 350, 35, { align: 'right', width: 195 });
    doc.text(fmtDate(payment?.createdAt || ride.timeline?.completedAt || ride.updatedAt), 350, 50, { align: 'right', width: 195 });

    doc.fillColor('#111').moveDown(4);
    let y = 120;
    const row = (label, value, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11).fillColor('#333').text(label, 50, y);
      doc.text(value, 300, y, { width: 245, align: 'right' });
      y += 20;
    };
    const section = (title) => {
      y += 10;
      doc.font('Helvetica-Bold').fontSize(13).fillColor(brand).text(title, 50, y);
      y += 22;
      doc.moveTo(50, y - 6).lineTo(545, y - 6).strokeColor('#e5e7eb').stroke();
    };

    section('Trip');
    row('Rider', ride.rider?.name || '-');
    row('Driver', ride.driver ? `${ride.driver.name} · ${ride.driver.driver?.vehicle?.plate || ''}` : '-');
    row('Ride type', RIDE_TYPES[ride.rideType]?.label || ride.rideType);
    row('Status', ride.status.replace('_', ' '));
    doc.font('Helvetica').fontSize(10).fillColor('#555');
    const place = (label, p) => {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#333').text(label, 50, y);
      doc.font('Helvetica').text(p.address, 120, y, { width: 425 });
      y = doc.y + 6;
    };
    place('Pickup', ride.pickup);
    (ride.stops || []).forEach((s, i) => place(`Stop ${i + 1}`, s));
    place('Drop-off', ride.dropoff);
    row('Distance', `${ride.distanceKm} km`);
    row('Started', fmtDate(ride.timeline?.startedAt));
    row('Ended', fmtDate(ride.timeline?.completedAt || ride.timeline?.cancelledAt));

    section('Fare breakdown');
    const f = ride.fare || {};
    if (ride.status === 'cancelled') {
      row('Cancellation fee', money(f.cancellationFee));
    } else {
      row('Base fare', money(f.baseFare));
      row('Distance', money(f.distanceFare));
      row('Time', money(f.timeFare));
      if (f.stopsFare) row('Extra stops', money(f.stopsFare));
      if (f.surgeMultiplier > 1) row('Demand multiplier', `x${f.surgeMultiplier}`);
      row('Subtotal', money(f.subtotal));
      if (f.discount) row(`Promo ${ride.promoCode || ''}`, `- ${money(f.discount)}`);
    }
    y += 4;
    doc.moveTo(50, y - 6).lineTo(545, y - 6).strokeColor('#111').stroke();
    row('Total paid', money(payment?.amount ?? (ride.status === 'cancelled' ? f.cancellationFee : f.total)), true);

    section('Payment');
    row('Method', (payment?.method || ride.paymentMethod || '-').toUpperCase());
    row('Status', payment?.status || ride.paymentStatus);
    if (payment?.providerRef) row('Transaction ref', payment.providerRef);

    doc.font('Helvetica').fontSize(9).fillColor('#888')
      .text('Thank you for riding with CabConnect. For help, visit Help & Support in the app.', 50, 770, { align: 'center', width: 495 });
    doc.end();
  });
}

module.exports = { buildReceiptPdf };
