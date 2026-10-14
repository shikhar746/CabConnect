import { Button, HStack, IconButton, Tooltip } from '@chakra-ui/react';
import { FiDownload, FiMail } from 'react-icons/fi';
import { useState } from 'react';
import { downloadFile } from '../services/api';
import { RideAPI } from '../services/endpoints';
import { useApiAction } from '../hooks/useApiAction';

export default function ReceiptActions({ ride, size = 'sm', email = true, compact = false }) {
  const [downloading, setDownloading] = useState(false);
  const [sendEmail, sending] = useApiAction(() => RideAPI.emailReceipt(ride._id), { success: (r) => `Receipt sent to ${r.data.to}`, errorTitle: 'Could not email receipt' });
  const [download] = useApiAction(async () => {
    setDownloading(true);
    try { await downloadFile(`/rides/${ride._id}/receipt`, `CabConnect-receipt-${String(ride._id).slice(-6)}.pdf`); } finally { setDownloading(false); }
  }, { errorTitle: 'Could not download receipt' });

  if (ride.paymentStatus !== 'paid') return null;
  if (compact) {
    return (
      <Tooltip label="Download receipt (PDF)">
        <IconButton size={size} variant="ghost" aria-label="Download receipt" icon={<FiDownload />} onClick={download} isLoading={downloading} />
      </Tooltip>
    );
  }
  return (
    <HStack spacing={2} flexWrap="wrap">
      <Button size={size} variant="outline" leftIcon={<FiDownload />} onClick={download} isLoading={downloading}>Receipt PDF</Button>
      {email && <Button size={size} variant="ghost" leftIcon={<FiMail />} onClick={sendEmail} isLoading={sending}>Email receipt</Button>}
    </HStack>
  );
}
