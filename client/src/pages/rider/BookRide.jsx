import { useEffect, useMemo, useState } from 'react';
import {
  Alert, AlertIcon, Badge, Box, Button, Card, CardBody, Flex, Grid, Heading, HStack, Icon, IconButton, Input, InputGroup, InputRightElement,
  Popover, PopoverArrow, PopoverBody, PopoverContent, PopoverTrigger, Skeleton, Stack, Text, Tooltip, useToast, VStack, Accordion,
  AccordionButton, AccordionIcon, AccordionItem, AccordionPanel, Divider,
} from '@chakra-ui/react';
import { FiPlus, FiTrash2, FiUsers, FiClock, FiTag, FiZap, FiArrowRight, FiCheck } from 'react-icons/fi';
import { MdTwoWheeler, MdElectricRickshaw, MdDirectionsCar, MdLocalTaxi, MdAirportShuttle } from 'react-icons/md';
import { Link, useNavigate } from 'react-router-dom';
import RideMap from '../../components/RideMap';
import PlaceInput from '../../components/PlaceInput';
import PaymentMethodSelect, { defaultPaymentValue, parsePaymentValue } from '../../components/PaymentMethodSelect';
import FareBreakdown from '../../components/FareBreakdown';
import { PageHeader } from '../../components/common';
import { MapsAPI, PromoAPI, RideAPI } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import { money } from '../../utils/format';

const TYPE_ICON = { bike: MdTwoWheeler, auto: MdElectricRickshaw, mini: MdDirectionsCar, sedan: MdLocalTaxi, suv: MdAirportShuttle };
const MAX_STOPS = 3;

export default function BookRide() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [stops, setStops] = useState([]);
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [quoting, setQuoting] = useState(false);
  const [rideType, setRideType] = useState('mini');
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState('');
  const [payment, setPayment] = useState(() => defaultPaymentValue(user));
  const [booking, setBooking] = useState(false);
  const [active, setActive] = useState(null);
  const [offers, setOffers] = useState([]);

  // Redirect to an in-progress ride; surface unpaid ones.
  useEffect(() => {
    RideAPI.active().then(({ data }) => {
      if (data && ['requested', 'accepted', 'arriving', 'in_progress'].includes(data.status)) navigate(`/ride/${data._id}`, { replace: true });
      else setActive(data);
    }).catch(() => {});
    PromoAPI.list().then(({ data }) => setOffers(data)).catch(() => {});
    refreshUser().catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const validStops = useMemo(() => stops.filter(Boolean), [stops]);

  // Re-quote whenever the route or promo changes.
  useEffect(() => {
    if (!pickup || !dropoff) {
      // Also clear in-flight state: the cancelled request won't do it (alive=false).
      setQuote(null);
      setQuoting(false);
      setQuoteError('');
      return undefined;
    }
    let alive = true;
    setQuoting(true);
    setQuoteError('');
    const t = setTimeout(() => {
      RideAPI.estimate({ pickup, dropoff, stops: validStops, promoCode: promo || undefined })
        .then(({ data }) => { if (alive) setQuote(data); })
        .catch((e) => { if (alive) { setQuote(null); setQuoteError(e.message); } })
        .finally(() => alive && setQuoting(false));
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [pickup, dropoff, validStops, promo]);

  const selected = quote?.options.find((o) => o.rideType === rideType);
  const promoState = quote?.promo;
  // The promo may apply to some ride types but not the selected one (e.g. minimum fare).
  const promoApplies = !!promoState?.valid && !selected?.promoError;
  const promoMessage = !promoState ? null : promoApplies
    ? `${promoState.code} applied – you save ${money(selected?.fare.discount)}`
    : selected?.promoError || promoState.error;

  const useMyLocation = () => {
    if (!navigator.geolocation) { toast({ title: 'Location is not available in this browser', status: 'warning' }); return; }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { data } = await MapsAPI.reverse({ lat: coords.latitude, lng: coords.longitude });
          setPickup(data);
        } catch (e) { toast({ title: 'Could not resolve your location', description: e.message, status: 'error' }); }
      },
      () => toast({ title: 'Location permission denied', description: 'Search for your pickup point instead.', status: 'warning' }),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const onMapClick = async (pt) => {
    try {
      const { data } = await MapsAPI.reverse(pt);
      if (!pickup) setPickup(data); else if (!dropoff) setDropoff(data);
      else toast({ title: 'Pickup and drop-off are set', description: 'Clear one of them to pick a new point on the map.', status: 'info' });
    } catch { /* ignore */ }
  };

  const swap = () => { setPickup(dropoff); setDropoff(pickup); };

  const book = async () => {
    const { method, paymentMethodId } = parsePaymentValue(payment);
    if (method === 'wallet' && selected && user.walletBalance < selected.fare.total) {
      toast({ title: 'Insufficient wallet balance', description: 'Top up your wallet in Profile or choose another method.', status: 'warning' });
      return;
    }
    setBooking(true);
    try {
      const { data } = await RideAPI.create({
        pickup, dropoff, stops: validStops, rideType, paymentMethod: method, paymentMethodId,
        promoCode: promoApplies ? promo : undefined,
      });
      toast({ title: 'Ride requested', description: data.driversNotified ? `Notified ${data.driversNotified} nearby driver(s).` : 'Searching for drivers nearby…', status: 'success' });
      navigate(`/ride/${data._id}`);
    } catch (e) {
      toast({ title: 'Could not book the ride', description: e.message, status: 'error' });
    } finally {
      setBooking(false);
    }
  };

  return (
    <Box>
      <PageHeader title={`Where to, ${user.name.split(' ')[0]}?`} subtitle="Set your pickup and destination to see fares for every ride type." />

      {active && (
        <Alert status="warning" borderRadius="card" mb={5}>
          <AlertIcon />
          <Box flex="1">You have an unpaid {active.status === 'cancelled' ? 'cancellation fee' : 'ride'} of {money(active.status === 'cancelled' ? active.fare.cancellationFee : active.fare.total)}.</Box>
          <Button size="sm" as={Link} to={`/ride/${active._id}`} colorScheme="orange">Pay now</Button>
        </Alert>
      )}

      <Grid templateColumns={{ base: '1fr', lg: '420px 1fr' }} gap={6} alignItems="start">
        {/* Inputs come first on phones – typing a destination is the main task, not the map. */}
        <Stack spacing={4}>
          <Card>
            <CardBody>
              <VStack align="stretch" spacing={3}>
                <PlaceInput label="Pickup location" placeholder="Pickup location" value={pickup} onChange={setPickup} color="brand.700" onUseMyLocation={useMyLocation} near={dropoff} autoFocus />
                {stops.map((s, i) => (
                  <HStack key={i} spacing={2}>
                    <Box flex="1"><PlaceInput label={`Stop ${i + 1}`} placeholder={`Stop ${i + 1}`} value={s} color="accent.600" near={pickup} onChange={(v) => setStops(stops.map((x, j) => (j === i ? v : x)))} /></Box>
                    <IconButton aria-label={`Remove stop ${i + 1}`} icon={<FiTrash2 />} variant="ghost" colorScheme="red" onClick={() => setStops(stops.filter((_, j) => j !== i))} />
                  </HStack>
                ))}
                <PlaceInput label="Drop-off location" placeholder="Where are you going?" value={dropoff} onChange={setDropoff} color="ink.900" near={pickup} />
                <HStack justify="space-between">
                  <Button size="sm" variant="ghost" leftIcon={<FiPlus />} isDisabled={stops.length >= MAX_STOPS} onClick={() => setStops([...stops, null])}>
                    Add stop {stops.length > 0 && `(${stops.length}/${MAX_STOPS})`}
                  </Button>
                  <Button size="sm" variant="ghost" isDisabled={!pickup && !dropoff} onClick={swap}>Swap</Button>
                </HStack>
                <Text fontSize="xs" color="text.muted">Tip: click on the map to drop a pin. Try “Airport”, “Koramangala” or “Whitefield”.</Text>
              </VStack>
            </CardBody>
          </Card>

          {quoteError && <Alert status="error" borderRadius="card"><AlertIcon />{quoteError}</Alert>}

          {(quoting && !quote) && <Stack>{[0, 1, 2].map((i) => <Skeleton key={i} h="68px" borderRadius="lg" />)}</Stack>}

          {quote && (
            <Card opacity={quoting ? 0.6 : 1} transition="opacity .2s">
              <CardBody>
                <Flex justify="space-between" align="center" mb={3}>
                  <Heading size="sm">Choose a ride</Heading>
                  <Text fontSize="sm" color="text.muted">{quote.distanceKm} km · ~{quote.durationMin} min</Text>
                </Flex>
                <VStack align="stretch" spacing={2} role="radiogroup" aria-label="Ride type">
                  {quote.options.map((o) => {
                    const isSel = o.rideType === rideType;
                    return (
                      <Flex key={o.rideType} as="button" type="button" role="radio" aria-checked={isSel} onClick={() => setRideType(o.rideType)}
                        align="center" gap={3} p={3} borderWidth="2px" borderRadius="lg" textAlign="left"
                        borderColor={isSel ? 'brand.500' : 'transparent'} bg={isSel ? 'brand.50' : 'bg.subtle'} _hover={{ borderColor: isSel ? 'brand.500' : 'ink.300' }} transition="all .15s">
                        <Flex boxSize={11} borderRadius="lg" bg="bg.surface" align="center" justify="center" flexShrink={0}><Icon as={TYPE_ICON[o.rideType]} boxSize={6} color="ink.800" /></Flex>
                        <Box flex="1" minW={0}>
                          <HStack spacing={2}>
                            <Text fontWeight={700}>{o.label}</Text>
                            <HStack spacing={0.5} color="text.muted" fontSize="xs"><Icon as={FiUsers} /><Text>{o.capacity}</Text></HStack>
                            {o.fare.surgeMultiplier > 1 && <Tooltip label="High demand right now"><Badge colorScheme="accent" fontSize="xs"><Icon as={FiZap} mr={0.5} />×{o.fare.surgeMultiplier}</Badge></Tooltip>}
                          </HStack>
                          <HStack spacing={1} fontSize="xs" color="text.muted"><Icon as={FiClock} /><Text noOfLines={1}>{o.durationMin} min · {o.description}</Text></HStack>
                        </Box>
                        <Box textAlign="right">
                          <Text fontWeight={700}>{money(o.fare.total)}</Text>
                          {o.fare.discount > 0 && <Text fontSize="xs" color="text.muted" textDecor="line-through">{money(o.fare.subtotal)}</Text>}
                        </Box>
                      </Flex>
                    );
                  })}
                </VStack>

                <Divider my={4} />

                <Text fontWeight={600} fontSize="sm" mb={2}>Promo code</Text>
                <HStack align="flex-start">
                  <InputGroup>
                    <Input value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} placeholder="Enter code" textTransform="uppercase"
                      onKeyDown={(e) => e.key === 'Enter' && setPromo(promoInput.trim())} isInvalid={!!promoState && !promoApplies} />
                    {promoApplies && <InputRightElement><Icon as={FiCheck} color="green.500" /></InputRightElement>}
                  </InputGroup>
                  {promo ? (
                    <Button variant="outline" onClick={() => { setPromo(''); setPromoInput(''); }}>Remove</Button>
                  ) : (
                    <Button variant="outline" onClick={() => setPromo(promoInput.trim())} isDisabled={!promoInput.trim()}>Apply</Button>
                  )}
                </HStack>
                {promoMessage && <Text fontSize="xs" mt={1} color={promoApplies ? 'green.600' : 'red.500'}>{promoMessage}</Text>}
                {offers.length > 0 && (
                  <Popover placement="bottom-start">
                    <PopoverTrigger><Button size="xs" variant="link" mt={2} leftIcon={<FiTag />}>View {offers.length} available offers</Button></PopoverTrigger>
                    <PopoverContent>
                      <PopoverArrow />
                      <PopoverBody>
                        <VStack align="stretch" spacing={2}>
                          {offers.map((o) => (
                            <Flex key={o.code} justify="space-between" align="center" gap={2}>
                              <Box><Badge colorScheme="accent">{o.code}</Badge><Text fontSize="xs" color="text.muted">{o.description}</Text></Box>
                              <Button size="xs" onClick={() => { setPromoInput(o.code); setPromo(o.code); }}>Apply</Button>
                            </Flex>
                          ))}
                        </VStack>
                      </PopoverBody>
                    </PopoverContent>
                  </Popover>
                )}

                <Divider my={4} />
                <Text fontWeight={600} fontSize="sm" mb={2}>Payment</Text>
                <PaymentMethodSelect user={user} value={payment} onChange={setPayment} amount={selected?.fare.total} />

                {selected && (
                  <Accordion allowToggle mt={4}>
                    <AccordionItem border="none">
                      <AccordionButton px={0} _hover={{ bg: 'transparent' }}><Text flex="1" textAlign="left" fontSize="sm" fontWeight={600}>Fare breakdown</Text><AccordionIcon /></AccordionButton>
                      <AccordionPanel px={0}><FareBreakdown fare={selected.fare} promoCode={promoApplies ? promoState.code : undefined} /></AccordionPanel>
                    </AccordionItem>
                  </Accordion>
                )}

                <Button mt={4} size="lg" w="100%" rightIcon={<FiArrowRight />} isLoading={booking} loadingText="Requesting…" isDisabled={!selected || quoting} onClick={book}>
                  Book {selected?.label} · {selected && money(selected.fare.total)}
                </Button>
              </CardBody>
            </Card>
          )}
        </Stack>

        <Box position={{ lg: 'sticky' }} top={{ lg: '88px' }}>
          <RideMap pickup={pickup} dropoff={dropoff} stops={validStops} path={quote?.path} onMapClick={onMapClick} height={{ base: '220px', md: '380px', lg: 'calc(100vh - 140px)' }} />
        </Box>
      </Grid>
    </Box>
  );
}
