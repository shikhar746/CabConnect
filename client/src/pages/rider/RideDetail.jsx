import { useCallback, useEffect, useState } from 'react';
import {
  Alert, AlertDescription, AlertIcon, AlertTitle, Avatar, Badge, Box, Button, Card, CardBody, Flex, Grid, Heading, HStack, Icon, Link,
  PinInput, PinInputField, Stack, Text, Textarea, useDisclosure, useToast, VStack, Divider, Spinner,
} from '@chakra-ui/react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { FiPhone, FiAlertOctagon, FiX, FiMapPin, FiShield, FiArrowLeft } from 'react-icons/fi';
import RideMap from '../../components/RideMap';
import RideTimeline from '../../components/RideTimeline';
import FareBreakdown from '../../components/FareBreakdown';
import PaymentMethodSelect, { parsePaymentValue } from '../../components/PaymentMethodSelect';
import ConfirmDialog from '../../components/ConfirmDialog';
import RatingForm from '../../components/RatingForm';
import ReceiptActions from '../../components/ReceiptActions';
import { Stars } from '../../components/RatingStars';
import { ErrorState, FullPageSpinner, PaymentStatusBadge, RideStatusBadge, SectionCard } from '../../components/common';
import { RideAPI } from '../../services/endpoints';
import { assetUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket, useSocketEvent } from '../../context/SocketContext';
import { money, RIDE_TYPE_LABEL, dateTime } from '../../utils/format';

const ACTIVE = ['requested', 'accepted', 'arriving', 'in_progress'];

const HEADLINE = {
  requested: ['Finding you a driver…', 'We have notified drivers near your pickup point.'],
  accepted: ['Your driver is on the way', 'Track them live on the map.'],
  arriving: ['Your driver has arrived', 'Share your ride PIN to start the trip.'],
  in_progress: ['On your way', 'Enjoy the ride. Help is one tap away.'],
  completed: ['You have arrived', 'Thanks for riding with CabConnect.'],
  cancelled: ['Ride cancelled', ''],
};

export default function RideDetail() {
  const { id } = useParams();
  const { user, refreshUser, config } = useAuth();
  const { socket, connected } = useSocket();
  const navigate = useNavigate();
  const toast = useToast();
  const [ride, setRide] = useState(null);
  const [error, setError] = useState(null);
  const [driverPos, setDriverPos] = useState(null);
  const [payment, setPayment] = useState('cash');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [sosSending, setSosSending] = useState(false);
  const [feeIfCancelled, setFeeIfCancelled] = useState(0);
  const [checkingFee, setCheckingFee] = useState(false);
  const cancelDlg = useDisclosure();
  const sosDlg = useDisclosure();
  const isRider = user.role === 'rider';

  const load = useCallback(async () => {
    try {
      const { data } = await RideAPI.get(id);
      setRide(data);
      setError(null);
      if (data.driverLocation?.lat) setDriverPos(data.driverLocation);
      return data;
    } catch (e) {
      setError(e);
      return null;
    }
  }, [id]);

  useEffect(() => {
    load().then((data) => {
      if (!data) return;
      const pm = data.paymentMethodId ? `${data.paymentMethod}:${data.paymentMethodId}` : data.paymentMethod;
      setPayment(pm);
    });
  }, [load]);

  // Cash can't pay a cancellation fee. Whenever the ride becomes cancelled (on this page,
  // by socket, or on load), move the selection to an in-app method so the form never sits empty.
  useEffect(() => {
    if (ride?.status !== 'cancelled') return;
    setPayment((current) => {
      if (current !== 'cash') return current;
      const def = user.paymentMethods?.find((p) => p.isDefault) || user.paymentMethods?.[0];
      return def ? `${def.type}:${def._id}` : 'wallet';
    });
  }, [ride?.status, user.paymentMethods]);

  // Live updates over WebSocket.
  useEffect(() => {
    if (!socket || !connected) return undefined;
    socket.emit('ride:join', id);
    return () => socket.emit('ride:leave', id);
  }, [socket, connected, id]);

  useSocketEvent('ride:update', (r) => {
    if (r._id !== id) return;
    setRide((prev) => ({ ...prev, ...r, otp: prev?.otp, payment: prev?.payment }));
    if (r.driverLocation?.lat) setDriverPos(r.driverLocation);
    if (['completed', 'cancelled'].includes(r.status)) { load(); refreshUser().catch(() => {}); }
  });
  useSocketEvent('ride:location', (p) => {
    if (p.rideId !== id) return;
    setDriverPos({ lat: p.lat, lng: p.lng });
    setRide((prev) => (prev ? { ...prev, etaMin: p.etaMin } : prev));
  });

  // Fallback polling while the socket is down and the ride is live.
  useEffect(() => {
    if (connected || !ride || !ACTIVE.includes(ride.status)) return undefined;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [connected, ride?.status, load]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!ride) return <FullPageSpinner />;

  const active = ACTIVE.includes(ride.status);
  const due = ride.status === 'cancelled' ? ride.fare?.cancellationFee : ride.fare?.total;
  const needsPayment = isRider && ['pending', 'failed'].includes(ride.paymentStatus) && ['completed', 'cancelled'].includes(ride.status);
  const canCancel = isRider && ['requested', 'accepted', 'arriving'].includes(ride.status);
  const d = ride.driver;
  const [headline, sub] = HEADLINE[ride.status] || ['', ''];

  // Ask the server what cancelling now would cost; the device clock may be wrong.
  const openCancel = async () => {
    setCheckingFee(true);
    const fresh = await load();
    setCheckingFee(false);
    if (!fresh || !['requested', 'accepted', 'arriving'].includes(fresh.status)) return;
    setFeeIfCancelled(fresh.cancellationFeeIfCancelledNow || 0);
    cancelDlg.onOpen();
  };

  const cancel = async () => {
    setCancelling(true);
    try {
      const { data } = await RideAPI.cancel(id, cancelReason.trim() || undefined);
      cancelDlg.onClose();
      toast({ title: 'Ride cancelled', description: data.cancellationFee ? `A ₹${data.cancellationFee} cancellation fee applies.` : 'No charge.', status: data.cancellationFee ? 'warning' : 'success' });
      await load();
    } catch (e) {
      toast({ title: 'Could not cancel', description: e.message, status: 'error' });
    } finally {
      setCancelling(false);
    }
  };

  const sendSos = () => {
    setSosSending(true);
    const send = async (coords) => {
      try {
        const { data } = await RideAPI.sos(id, { ...coords, message: 'SOS triggered from the CabConnect app' });
        sosDlg.onClose();
        toast({
          title: 'SOS sent', status: 'error', duration: 10000,
          description: `Your live location was shared with ${data.contactsNotified.length} emergency contact(s) and our safety team. Call 112 if you are in immediate danger.`,
        });
      } catch (e) {
        toast({ title: 'SOS failed – call 112 directly', description: e.message, status: 'error' });
      } finally {
        setSosSending(false);
      }
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => send({ lat: coords.latitude, lng: coords.longitude }),
        () => send(driverPos || {}),
        { timeout: 4000 },
      );
    } else send(driverPos || {});
  };

  const pay = async () => {
    setPaying(true);
    setPayError('');
    try {
      const { method, paymentMethodId } = parsePaymentValue(payment);
      await RideAPI.pay(id, { method, paymentMethodId }); // success toast arrives as a live notification
      await Promise.all([load(), refreshUser()]);
    } catch (e) {
      setPayError(e.message);
      load();
    } finally {
      setPaying(false);
    }
  };

  return (
    <Box>
      <Button variant="ghost" size="sm" leftIcon={<FiArrowLeft />} mb={3} onClick={() => navigate(-1)}>Back</Button>
      <Grid templateColumns={{ base: '1fr', lg: '1fr 400px' }} gap={6} alignItems="start">
        <Stack spacing={4}>
          <Box position="relative">
            <RideMap pickup={ride.pickup} stops={ride.stops} dropoff={ride.dropoff} path={ride.route} driver={active ? driverPos : null} height={{ base: '320px', md: '460px' }} />
            {active && ride.etaMin !== undefined && ride.etaMin !== null && ride.status !== 'requested' && (
              <Box position="absolute" top={3} left={3} zIndex={500} bg="ink.900" color="white" px={4} py={2} borderRadius="lg" boxShadow="raised">
                <Text fontSize="xs" color="ink.300">{ride.status === 'in_progress' ? 'Arriving at destination in' : 'Driver arrives in'}</Text>
                <Text fontSize="xl" fontWeight={800}>{ride.etaMin <= 0 ? 'Now' : `${ride.etaMin} min`}</Text>
              </Box>
            )}
          </Box>

          <SectionCard title="Trip details" action={<HStack><RideStatusBadge status={ride.status} /><PaymentStatusBadge status={ride.paymentStatus} /></HStack>}>
            <VStack align="stretch" spacing={3}>
              {[['P', 'brand.700', ride.pickup], ...ride.stops.map((s, i) => [i + 1, 'accent.600', s]), ['D', 'ink.900', ride.dropoff]].map(([l, c, p]) => (
                <HStack key={`${l}`} align="flex-start" spacing={3}>
                  <Flex boxSize={6} borderRadius="full" bg={c} color="white" fontSize="xs" fontWeight={700} align="center" justify="center" flexShrink={0}>{l}</Flex>
                  <Text fontSize="sm">{p.address}</Text>
                </HStack>
              ))}
              <Divider />
              <Flex gap={6} flexWrap="wrap" fontSize="sm" color="text.muted">
                <Text><b>{RIDE_TYPE_LABEL[ride.rideType]}</b></Text>
                <Text>{ride.distanceKm} km</Text>
                <Text>~{ride.durationMin} min</Text>
                <Text>Booked {dateTime(ride.createdAt)}</Text>
                <Text textTransform="uppercase">{ride.paymentMethod}</Text>
              </Flex>
            </VStack>
          </SectionCard>
        </Stack>

        <Stack spacing={4}>
          {/* The next action (pay, then rate) always comes first. */}
          {needsPayment && (
            <SectionCard title={ride.status === 'cancelled' ? `Pay cancellation fee · ${money(due)}` : `Pay for your trip · ${money(due)}`}>
              {payError && (
                <Alert status="error" borderRadius="md" mb={3}><AlertIcon /><Box><AlertTitle fontSize="sm">Payment failed</AlertTitle><AlertDescription fontSize="sm">{payError} Try another method.</AlertDescription></Box></Alert>
              )}
              <PaymentMethodSelect user={user} value={payment} onChange={setPayment} allowCash={ride.status !== 'cancelled'} amount={due} afterTrip />
              <Button w="100%" mt={4} size="lg" onClick={pay} isLoading={paying} loadingText="Processing…">Pay {money(due)}</Button>
              {config?.paymentProvider === 'mock' && <Text fontSize="xs" color="text.muted" mt={2}>Demo payments: cards ending 0002 are declined, UPI IDs containing “fail” fail.</Text>}
            </SectionCard>
          )}

          {isRider && ride.status === 'completed' && ride.paymentStatus === 'paid' && !ride.rated && d && (
            <SectionCard title="Rate your driver"><RatingForm rideId={ride._id} driverName={d.name.split(' ')[0]} onDone={load} /></SectionCard>
          )}

          <Card bg={ride.status === 'cancelled' ? 'red.50' : 'bg.surface'}>
            <CardBody>
              <HStack spacing={3} mb={1}>
                {ride.status === 'requested' && <Spinner size="sm" color="brand.500" />}
                <Heading size="md">{headline}</Heading>
              </HStack>
              {sub && <Text color="text.muted" fontSize="sm">{sub}</Text>}

              {isRider && ['accepted', 'arriving'].includes(ride.status) && ride.otp && (
                <Box mt={4} p={4} borderRadius="lg" bg="brand.50" borderWidth="1px" borderColor="brand.100">
                  <HStack mb={2}><Icon as={FiShield} color="brand.700" /><Text fontSize="sm" fontWeight={700} color="brand.800">Ride PIN</Text></HStack>
                  <HStack spacing={2}>
                    <PinInput value={ride.otp} isDisabled size="lg"><PinInputField fontWeight={800} color="ink.900" opacity="1 !important" /><PinInputField fontWeight={800} opacity="1 !important" /><PinInputField fontWeight={800} opacity="1 !important" /><PinInputField fontWeight={800} opacity="1 !important" /></PinInput>
                  </HStack>
                  <Text fontSize="xs" color="brand.800" mt={2}>Only share this with your driver once you are in the vehicle.</Text>
                </Box>
              )}

              {d && (
                <Flex mt={4} p={3} borderRadius="lg" bg="bg.subtle" align="center" gap={3}>
                  <Avatar name={d.name} src={assetUrl(d.avatarUrl)} />
                  <Box flex="1" minW={0}>
                    <Link as={RouterLink} to={`/drivers/${d._id}`} fontWeight={700}>{d.name}</Link>
                    <Stars value={d.driver?.rating} count={d.driver?.ratingCount} size={3} />
                    <Text fontSize="xs" color="text.muted" noOfLines={1}>{d.driver?.vehicle?.color} {d.driver?.vehicle?.make} {d.driver?.vehicle?.model}</Text>
                  </Box>
                  <VStack spacing={1} align="flex-end">
                    <Badge fontSize="sm" variant="outline" colorScheme="gray" px={2} letterSpacing="wider">{d.driver?.vehicle?.plate}</Badge>
                    {active && d.phone && <Button as="a" href={`tel:${d.phone}`} size="xs" leftIcon={<FiPhone />} variant="outline">Call</Button>}
                  </VStack>
                </Flex>
              )}

              {(canCancel || (active && ride.status !== 'requested' && isRider)) && (
                <HStack mt={4} spacing={3}>
                  {canCancel && <Button flex="1" variant="outline" colorScheme="red" leftIcon={<FiX />} onClick={openCancel} isLoading={checkingFee}>Cancel ride</Button>}
                  {isRider && ['accepted', 'arriving', 'in_progress'].includes(ride.status) && (
                    <Button flex="1" colorScheme="red" leftIcon={<FiAlertOctagon />} onClick={sosDlg.onOpen}>SOS</Button>
                  )}
                </HStack>
              )}
            </CardBody>
          </Card>

          <SectionCard title="Fare" action={<ReceiptActions ride={ride} />}>
            <FareBreakdown fare={ride.fare} promoCode={ride.promoCode} cancelled={ride.status === 'cancelled'} />
            {ride.payment && <Text fontSize="xs" color="text.muted" mt={3}>Paid via {ride.payment.method.toUpperCase()} · {ride.payment.receiptNumber}</Text>}
          </SectionCard>

          <SectionCard title="Status"><RideTimeline ride={ride} /></SectionCard>

          {!active && isRider && <Button as={RouterLink} to="/book" variant="outline" leftIcon={<FiMapPin />}>Book another ride</Button>}
        </Stack>
      </Grid>

      <ConfirmDialog isOpen={cancelDlg.isOpen} onClose={cancelDlg.onClose} onConfirm={cancel} isLoading={cancelling} title="Cancel this ride?" confirmLabel="Cancel ride">
        {feeIfCancelled > 0 ? (
          <Alert status="warning" borderRadius="md" mb={3} fontSize="sm"><AlertIcon />Your driver is already on the way. A cancellation fee of {money(feeIfCancelled)} will apply.</Alert>
        ) : (
          <Text fontSize="sm" mb={3}>{ride.status === 'requested' ? 'No driver has been assigned yet, so there is no charge.' : `You can cancel for free within ${config?.cancellationFreeWindowMin ?? 2} minutes of the driver accepting.`}</Text>
        )}
        <Textarea placeholder="Reason (optional)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} maxLength={200} />
      </ConfirmDialog>

      <ConfirmDialog isOpen={sosDlg.isOpen} onClose={sosDlg.onClose} onConfirm={sendSos} isLoading={sosSending} title="Send an SOS alert?" confirmLabel="Send SOS">
        <Text fontSize="sm">We will share your live location and vehicle details with your {user.emergencyContacts?.length || 0} emergency contact(s) and alert the CabConnect safety team.</Text>
        {!user.emergencyContacts?.length && <Alert status="warning" mt={3} borderRadius="md" fontSize="sm"><AlertIcon />You have no emergency contacts. Add them in your profile.</Alert>}
        <Text fontSize="sm" mt={3} fontWeight={600}>If you are in immediate danger, call 112.</Text>
      </ConfirmDialog>
    </Box>
  );
}
