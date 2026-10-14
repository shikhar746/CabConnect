import { useCallback, useEffect, useState } from 'react';
import {
  Alert, AlertIcon, Avatar, Badge, Box, Button, Card, CardBody, Flex, FormControl, FormLabel, Grid, Heading, HStack, Icon, Input,
  SimpleGrid, Stack, Switch, Text, Textarea, useDisclosure, useToast, VStack, Divider, Tooltip,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { FiCrosshair, FiDollarSign, FiNavigation, FiPhone, FiStar, FiCheckCircle, FiMapPin, FiX, FiAlertOctagon, FiInbox } from 'react-icons/fi';
import RideMap from '../../components/RideMap';
import ConfirmDialog from '../../components/ConfirmDialog';
import { EmptyState, PageHeader, RideStatusBadge, SectionCard, StatCard } from '../../components/common';
import { DriverAPI, RideAPI } from '../../services/endpoints';
import { assetUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket, useSocketEvent } from '../../context/SocketContext';
import { money, RIDE_TYPE_LABEL, shortAddress, timeAgo } from '../../utils/format';

function RequestCard({ req, onAccept, onDecline, busy }) {
  return (
    <Card borderColor="brand.200" borderWidth="2px" className="fade-in">
      <CardBody>
        <Flex justify="space-between" align="flex-start" mb={3}>
          <Box>
            <HStack><Badge colorScheme="brand">{RIDE_TYPE_LABEL[req.rideType]}</Badge><Badge variant="outline" textTransform="uppercase">{req.paymentMethod}</Badge></HStack>
            <Text fontSize="xs" color="text.muted" mt={1}>{req.distanceToPickupKm !== undefined ? `${req.distanceToPickupKm} km to pickup · ` : ''}{timeAgo(req.createdAt)}</Text>
          </Box>
          <Box textAlign="right">
            <Text fontSize="2xl" fontWeight={800} color="brand.700">{money(req.fare.total)}</Text>
            <Text fontSize="xs" color="text.muted">{req.distanceKm} km · ~{req.durationMin} min</Text>
          </Box>
        </Flex>
        <VStack align="stretch" spacing={1.5} fontSize="sm" mb={4}>
          <HStack align="flex-start"><Icon as={FiMapPin} color="brand.700" mt={1} /><Text>{req.pickup.address}</Text></HStack>
          {req.stops?.length > 0 && <Text pl={6} fontSize="xs" color="accent.700">+ {req.stops.length} stop{req.stops.length > 1 ? 's' : ''}: {req.stops.map((s) => shortAddress(s.address)).join(', ')}</Text>}
          <HStack align="flex-start"><Icon as={FiMapPin} color="ink.900" mt={1} /><Text>{req.dropoff.address}</Text></HStack>
        </VStack>
        <HStack>
          <Button flex="1" variant="outline" colorScheme="gray" onClick={() => onDecline(req._id)} isDisabled={busy}>Decline</Button>
          <Button flex="2" onClick={() => onAccept(req._id)} isLoading={busy === req._id}>Accept ride</Button>
        </HStack>
      </CardBody>
    </Card>
  );
}

function ActiveRide({ ride, driverPos, onChange }) {
  const toast = useToast();
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState('');
  const [reason, setReason] = useState('');
  const cancelDlg = useDisclosure();
  const r = ride.rider;

  const act = async (key, fn, success) => {
    setBusy(key);
    try {
      const { data } = await fn();
      onChange(data?.ride || data);
      if (success) toast({ title: success, status: 'success' });
    } catch (e) {
      toast({ title: 'Action failed', description: e.message, status: 'error' });
    } finally {
      setBusy('');
    }
  };

  return (
    <Grid templateColumns={{ base: '1fr', xl: '1fr 380px' }} gap={6}>
      <RideMap pickup={ride.pickup} stops={ride.stops} dropoff={ride.dropoff} path={ride.route} driver={driverPos} height={{ base: '320px', md: '480px' }} />
      <Stack spacing={4}>
        <Card>
          <CardBody>
            <Flex justify="space-between" align="center" mb={3}><Heading size="sm">Current trip</Heading><RideStatusBadge status={ride.status} /></Flex>
            <Flex align="center" gap={3} p={3} bg="bg.subtle" borderRadius="lg" mb={4}>
              <Avatar size="sm" name={r?.name} src={assetUrl(r?.avatarUrl)} />
              <Box flex="1"><Text fontWeight={700}>{r?.name}</Text><Text fontSize="xs" color="text.muted">Rider · {RIDE_TYPE_LABEL[ride.rideType]}</Text></Box>
              {r?.phone && <Button as="a" href={`tel:${r.phone}`} size="sm" leftIcon={<FiPhone />} variant="outline">Call</Button>}
            </Flex>
            <VStack align="stretch" spacing={2} fontSize="sm">
              <HStack align="flex-start"><Icon as={FiMapPin} color="brand.700" mt={1} /><Text>{ride.pickup.address}</Text></HStack>
              {ride.stops.map((s, i) => <HStack key={i} align="flex-start"><Icon as={FiMapPin} color="accent.600" mt={1} /><Text>Stop {i + 1}: {s.address}</Text></HStack>)}
              <HStack align="flex-start"><Icon as={FiMapPin} color="ink.900" mt={1} /><Text>{ride.dropoff.address}</Text></HStack>
            </VStack>
            <Divider my={4} />
            <Flex justify="space-between" fontSize="sm"><Text color="text.muted">Fare ({ride.paymentMethod.toUpperCase()})</Text><Text fontWeight={800}>{money(ride.fare.total)}</Text></Flex>
            {ride.etaMin !== undefined && ride.etaMin !== null && ride.status !== 'arriving' && (
              <Flex justify="space-between" fontSize="sm" mt={1}><Text color="text.muted">{ride.status === 'in_progress' ? 'ETA to drop-off' : 'ETA to pickup'}</Text><Text fontWeight={700}>{ride.etaMin} min</Text></Flex>
            )}
          </CardBody>
        </Card>

        {['accepted', 'arriving'].includes(ride.status) && (
          <SectionCard title="Start the trip">
            <FormControl>
              <FormLabel fontSize="sm">Enter the rider&apos;s 4-digit PIN</FormLabel>
              {/* One numeric field instead of Chakra's 4-box PinInput: PinInput moves focus on the next
                  animation frame, so fast typing/autofill on a busy device dropped digits (see README §12). */}
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={(e) => { if (e.key === 'Enter' && otp.length === 4) act('start', () => DriverAPI.start(ride._id, otp), 'Trip started'); }}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                placeholder="••••"
                size="lg"
                w="180px"
                textAlign="center"
                fontSize="2xl"
                fontWeight={800}
                letterSpacing="0.5em"
              />
            </FormControl>
            <Button w="100%" mt={4} leftIcon={<FiNavigation />} isDisabled={otp.length !== 4} isLoading={busy === 'start'} onClick={() => act('start', () => DriverAPI.start(ride._id, otp), 'Trip started')}>Start trip</Button>
            {/* Kept below the PIN so the layout doesn't shift when the driver arrives. */}
            {ride.status === 'accepted' && (
              <Button w="100%" mt={2} variant="outline" leftIcon={<FiCheckCircle />} isLoading={busy === 'arrive'} onClick={() => act('arrive', () => DriverAPI.arrive(ride._id), 'Rider notified that you have arrived')}>
                I&apos;ve arrived at pickup
              </Button>
            )}
            <Button w="100%" mt={2} variant="ghost" colorScheme="red" leftIcon={<FiX />} onClick={cancelDlg.onOpen}>Cancel trip</Button>
          </SectionCard>
        )}

        {ride.status === 'in_progress' && (
          <SectionCard title="On trip">
            <Text fontSize="sm" color="text.muted" mb={4}>Drop the rider at their destination, then complete the trip.{ride.paymentMethod === 'cash' && ` Collect ${money(ride.fare.total)} in cash.`}</Text>
            <Button w="100%" size="lg" colorScheme="green" leftIcon={<FiCheckCircle />} isLoading={busy === 'complete'} onClick={() => act('complete', () => DriverAPI.complete(ride._id), 'Trip completed')}>Complete trip</Button>
            <Button w="100%" mt={2} variant="ghost" colorScheme="red" leftIcon={<FiAlertOctagon />} isLoading={busy === 'sos'}
              onClick={() => act('sos', async () => { await RideAPI.sos(ride._id, driverPos || {}); return { data: ride }; }, 'SOS sent to the safety team')}>
              Emergency SOS
            </Button>
          </SectionCard>
        )}
      </Stack>

      <ConfirmDialog isOpen={cancelDlg.isOpen} onClose={cancelDlg.onClose} title="Cancel this trip?" confirmLabel="Cancel trip" isLoading={busy === 'cancel'}
        onConfirm={async () => { await act('cancel', () => RideAPI.cancel(ride._id, reason || undefined), 'Trip released to other drivers'); cancelDlg.onClose(); }}>
        <Text fontSize="sm" mb={3}>The rider will be matched with another driver. Frequent cancellations affect your account standing.</Text>
        <Textarea placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
      </ConfirmDialog>
    </Grid>
  );
}

export default function DriverDashboard() {
  const { user, setUser } = useAuth();
  const { socket, connected } = useSocket();
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [accepting, setAccepting] = useState('');
  const [driverPos, setDriverPos] = useState(() => {
    const c = user.driver?.location?.coordinates;
    return c ? { lat: c[1], lng: c[0] } : null;
  });
  const online = !!user.driver?.isOnline;

  const loadActive = useCallback(async () => {
    const { data } = await RideAPI.active();
    setActiveRide(data && ['accepted', 'arriving', 'in_progress'].includes(data.status) ? data : null);
    if (data?.driverLocation?.lat) setDriverPos(data.driverLocation);
  }, []);
  const loadRequests = useCallback(async () => { const { data } = await DriverAPI.requests(); setRequests(data); }, []);
  const loadEarnings = useCallback(() => DriverAPI.earnings().then(({ data }) => setEarnings(data)).catch(() => {}), []);

  useEffect(() => { loadActive().catch(() => {}); loadEarnings(); }, [loadActive, loadEarnings]);
  useEffect(() => { if (online && !activeRide) loadRequests().catch(() => {}); }, [online, activeRide, loadRequests]);

  // Fallback refresh while online (in case a socket event was missed).
  useEffect(() => {
    if (!online || activeRide) return undefined;
    const t = setInterval(() => loadRequests().catch(() => {}), connected ? 20000 : 6000);
    return () => clearInterval(t);
  }, [online, activeRide, connected, loadRequests]);

  useEffect(() => {
    if (!socket || !connected || !activeRide) return undefined;
    socket.emit('ride:join', activeRide._id);
    return () => socket.emit('ride:leave', activeRide._id);
  }, [socket, connected, activeRide?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useSocketEvent('ride:request', (req) => {
    if (activeRide) return;
    setRequests((prev) => (prev.some((r) => r._id === req._id) ? prev : [req, ...prev]));
  });
  useSocketEvent('ride:taken', ({ rideId }) => setRequests((prev) => prev.filter((r) => r._id !== rideId)));
  useSocketEvent('ride:location', (p) => { if (activeRide && p.rideId === activeRide._id) { setDriverPos({ lat: p.lat, lng: p.lng }); setActiveRide((r) => ({ ...r, etaMin: p.etaMin })); } });
  useSocketEvent('ride:update', (r) => {
    if (!activeRide || r._id !== activeRide._id) return;
    if (['completed', 'cancelled', 'requested'].includes(r.status)) {
      if (r.status === 'cancelled') toast({ title: 'The rider cancelled this trip', status: 'warning' });
      setActiveRide(null);
      loadEarnings();
    } else setActiveRide(r);
  });

  const toggleOnline = async (next) => {
    setToggling(true);
    try {
      const { data } = await DriverAPI.setStatus({ isOnline: next, ...(driverPos || {}) });
      setUser(data.user);
      setRequests(data.requests || []);
      toast({ title: next ? 'You are online' : 'You are offline', description: next ? 'Ride requests near you will appear here.' : undefined, status: next ? 'success' : 'info' });
    } catch (e) {
      toast({ title: 'Could not change status', description: e.message, status: 'error' });
    } finally {
      setToggling(false);
    }
  };

  const updateLocation = async (pos) => {
    try {
      await DriverAPI.location(pos);
      setDriverPos(pos);
      if (online) loadRequests().catch(() => {});
      toast({ title: 'Location updated', status: 'success', duration: 2000 });
    } catch (e) {
      toast({ title: 'Could not update location', description: e.message, status: 'error' });
    }
  };

  const useGps = () => {
    if (!navigator.geolocation) { toast({ title: 'GPS not available', status: 'warning' }); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => updateLocation({ lat: coords.latitude, lng: coords.longitude }),
      () => toast({ title: 'Location permission denied', description: 'Click on the map to set your position instead.', status: 'warning' }),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const accept = async (id) => {
    setAccepting(id);
    try {
      const { data } = await DriverAPI.accept(id);
      setActiveRide(data);
      setRequests([]);
      toast({ title: 'Ride accepted', description: 'Head to the pickup point.', status: 'success' });
    } catch (e) {
      toast({ title: 'Could not accept', description: e.message, status: 'error' });
      setRequests((prev) => prev.filter((r) => r._id !== id));
    } finally {
      setAccepting('');
    }
  };

  const decline = async (id) => {
    setRequests((prev) => prev.filter((r) => r._id !== id));
    try { await DriverAPI.decline(id); } catch { /* already gone */ }
  };

  return (
    <Box>
      <PageHeader
        title={`Hello, ${user.name.split(' ')[0]}`}
        subtitle={activeRide ? 'You are on a trip.' : online ? 'You are online and visible to riders nearby.' : 'Go online to start receiving ride requests.'}
        actions={(
          <Tooltip label={activeRide ? 'Finish your trip before going offline' : ''}>
            <HStack as="label" px={4} py={2} bg={online ? 'green.50' : 'bg.surface'} borderWidth="1px" borderColor={online ? 'green.200' : 'border.subtle'} borderRadius="full" cursor="pointer">
              <Box boxSize={2.5} borderRadius="full" bg={online ? 'green.400' : 'ink.300'} />
              <Text fontWeight={700} fontSize="sm">{online ? 'Online' : 'Offline'}</Text>
              <Switch isChecked={online} onChange={(e) => toggleOnline(e.target.checked)} isDisabled={toggling || !!activeRide} colorScheme="green" aria-label="Online status" />
            </HStack>
          </Tooltip>
        )}
      />

      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <StatCard label="Today" value={money(earnings?.today.earnings)} hint={`${earnings?.today.trips || 0} trips`} icon={FiDollarSign} />
        <StatCard label="This week" value={money(earnings?.week.earnings)} hint={`${earnings?.week.trips || 0} trips`} icon={FiNavigation} />
        <StatCard label="Rating" value={user.driver?.rating ? user.driver.rating.toFixed(2) : 'New'} hint={`${user.driver?.ratingCount || 0} reviews`} icon={FiStar} tone="accent" />
        <StatCard label="Pending payout" value={money(earnings?.pendingPayout)} hint={<RouterLink to="/driver/earnings">View earnings →</RouterLink>} icon={FiDollarSign} tone="green" />
      </SimpleGrid>

      {activeRide ? (
        <ActiveRide ride={activeRide} driverPos={driverPos} onChange={(r) => { if (r && ['completed', 'cancelled', 'requested'].includes(r.status)) { setActiveRide(null); loadEarnings(); } else if (r) setActiveRide(r); }} />
      ) : (
        <Grid templateColumns={{ base: '1fr', xl: '1fr 420px' }} gap={6} alignItems="start">
          <Box>
            <RideMap pickup={null} driver={driverPos} height={{ base: '300px', md: '460px' }} onMapClick={updateLocation}
              requests={requests.map((r) => ({ id: r._id, ...r.pickup, label: money(r.fare.total) }))} />
            <HStack mt={3} justify="space-between" flexWrap="wrap" gap={2}>
              <Text fontSize="xs" color="text.muted">Click the map to set your position, or use GPS. Amber price tags mark the pickup points of open requests.</Text>
              <Button size="sm" variant="outline" leftIcon={<FiCrosshair />} onClick={useGps}>Use GPS</Button>
            </HStack>
          </Box>
          <Stack spacing={4}>
            <Heading size="sm">Ride requests {requests.length > 0 && <Badge ml={1} colorScheme="brand">{requests.length}</Badge>}</Heading>
            {!user.driver?.vehicle?.type && <Alert status="warning" borderRadius="card"><AlertIcon />Add your vehicle in Profile before going online.</Alert>}
            {!online ? (
              <EmptyState icon={FiInbox} title="You are offline" description="Switch online to see ride requests near you." action={<Button onClick={() => toggleOnline(true)} isLoading={toggling}>Go online</Button>} />
            ) : requests.length === 0 ? (
              <EmptyState icon={FiInbox} title="Waiting for requests…" description={`Requests for ${RIDE_TYPE_LABEL[user.driver?.vehicle?.type] || 'your vehicle'} rides within range will appear here in real time.`} />
            ) : (
              requests.map((r) => <RequestCard key={r._id} req={r} onAccept={accept} onDecline={decline} busy={accepting} />)
            )}
          </Stack>
        </Grid>
      )}
    </Box>
  );
}
