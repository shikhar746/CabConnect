import { useState } from 'react';
import {
  Box, Button, Card, CardBody, Flex, HStack, Icon, Input, InputGroup, InputLeftElement, Select, SimpleGrid, Stack, Text, VStack,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { FiSearch, FiNavigation, FiMapPin, FiChevronRight, FiCheckCircle, FiXCircle, FiTrendingUp } from 'react-icons/fi';
import { EmptyState, ErrorState, LoadingState, PageHeader, Pagination, PaymentStatusBadge, RideStatusBadge, StatCard } from '../../components/common';
import ReceiptActions from '../../components/ReceiptActions';
import { RideAPI } from '../../services/endpoints';
import { useAsync, useDebounce } from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { dateTime, money, RIDE_TYPE_LABEL, shortAddress } from '../../utils/format';

export default function RideHistory() {
  const { user } = useAuth();
  const isDriver = user.role === 'driver';
  const [filters, setFilters] = useState({ status: '', rideType: '', sort: 'newest', q: '', page: 1 });
  const q = useDebounce(filters.q, 350);
  const { data, meta, loading, error, reload } = useAsync(
    () => RideAPI.list({ ...filters, q: q || undefined, status: filters.status || undefined, rideType: filters.rideType || undefined, limit: 8 }),
    [filters.status, filters.rideType, filters.sort, filters.page, q],
  );
  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value, page: 1 });

  const summary = meta?.summary || [];
  const completed = summary.find((s) => s._id === 'completed');
  const cancelled = summary.find((s) => s._id === 'cancelled');

  return (
    <Box>
      <PageHeader title={isDriver ? 'Trip history' : 'My rides'} subtitle={isDriver ? 'Every trip you have driven.' : 'Your past and upcoming trips, payments and receipts.'}
        actions={!isDriver && <Button as={RouterLink} to="/book" leftIcon={<FiNavigation />}>Book a ride</Button>} />

      <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={4} mb={6}>
        <StatCard label="Completed trips" value={completed?.count || 0} icon={FiCheckCircle} hint={`${Math.round(completed?.km || 0)} km travelled`} />
        <StatCard label={isDriver ? 'Fares collected' : 'Total spent'} value={money(completed?.spend)} icon={FiTrendingUp} tone="accent" />
        <StatCard label="Cancelled" value={cancelled?.count || 0} icon={FiXCircle} tone="red" />
      </SimpleGrid>

      <Card mb={4}>
        <CardBody>
          <Stack direction={{ base: 'column', md: 'row' }} spacing={3}>
            <InputGroup flex="2">
              <InputLeftElement pointerEvents="none"><Icon as={FiSearch} color="text.muted" /></InputLeftElement>
              <Input placeholder="Search by pickup or drop-off" value={filters.q} onChange={set('q')} aria-label="Search rides" />
            </InputGroup>
            <Select flex="1" value={filters.status} onChange={set('status')} aria-label="Filter by status">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
            <Select flex="1" value={filters.rideType} onChange={set('rideType')} aria-label="Filter by ride type">
              <option value="">All ride types</option>
              {Object.entries(RIDE_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
            <Select flex="1" value={filters.sort} onChange={set('sort')} aria-label="Sort">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="fare_high">Fare: high to low</option>
              <option value="fare_low">Fare: low to high</option>
            </Select>
          </Stack>
        </CardBody>
      </Card>

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <LoadingState rows={4} />}
      {data && data.length === 0 && (
        <EmptyState icon={FiMapPin} title="No rides found" description={filters.q || filters.status || filters.rideType ? 'Try clearing your filters.' : isDriver ? 'Go online to start accepting trips.' : 'Your trips will show up here after you book.'}
          action={!isDriver && <Button as={RouterLink} to="/book">Book your first ride</Button>} />
      )}

      <VStack align="stretch" spacing={3} opacity={loading ? 0.6 : 1}>
        {data?.map((r) => {
          const other = isDriver ? r.rider : r.driver;
          return (
            <Card key={r._id} _hover={{ boxShadow: 'raised' }} transition="box-shadow .2s">
              <CardBody>
                <Flex gap={4} direction={{ base: 'column', md: 'row' }} align={{ md: 'center' }}>
                  <Box flex="1" minW={0}>
                    <HStack spacing={2} mb={2} flexWrap="wrap">
                      <RideStatusBadge status={r.status} />
                      <PaymentStatusBadge status={r.paymentStatus} />
                      <Text fontSize="xs" color="text.muted">{dateTime(r.createdAt)} · {RIDE_TYPE_LABEL[r.rideType]} · {r.distanceKm} km</Text>
                    </HStack>
                    <HStack spacing={2} fontSize="sm" fontWeight={600} flexWrap="wrap">
                      <Text noOfLines={1}>{shortAddress(r.pickup.address)}</Text>
                      <Icon as={FiChevronRight} color="text.muted" />
                      {r.stops?.length > 0 && <><Text color="text.muted" fontWeight={400}>{r.stops.length} stop{r.stops.length > 1 ? 's' : ''}</Text><Icon as={FiChevronRight} color="text.muted" /></>}
                      <Text noOfLines={1}>{shortAddress(r.dropoff.address)}</Text>
                    </HStack>
                    {other && <Text fontSize="xs" color="text.muted" mt={1}>{isDriver ? 'Rider' : 'Driver'}: {other.name}{!isDriver && other.driver?.vehicle?.plate ? ` · ${other.driver.vehicle.plate}` : ''}</Text>}
                  </Box>
                  <HStack spacing={4} justify="space-between">
                    <Text fontWeight={800} fontSize="lg">{money(r.status === 'cancelled' ? r.fare.cancellationFee : r.fare.total)}</Text>
                    <HStack>
                      <ReceiptActions ride={r} compact />
                      <Button as={RouterLink} to={`/ride/${r._id}`} size="sm" variant="ghost" rightIcon={<FiChevronRight />}>Details</Button>
                    </HStack>
                  </HStack>
                </Flex>
              </CardBody>
            </Card>
          );
        })}
      </VStack>
      <Pagination meta={meta} onChange={(page) => setFilters({ ...filters, page })} />
    </Box>
  );
}
