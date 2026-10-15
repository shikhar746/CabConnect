import { useState } from 'react';
import {
  Box, Card, CardBody, Icon, Input, InputGroup, InputLeftElement, Select, Stack, Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiMap } from 'react-icons/fi';
import { EmptyState, ErrorState, LoadingState, PageHeader, Pagination, PaymentStatusBadge, RideStatusBadge } from '../../components/common';
import { AdminAPI } from '../../services/endpoints';
import { useAsync, useDebounce } from '../../hooks/useAsync';
import { useSocketEvent } from '../../context/SocketContext';
import { dateTime, money, RIDE_TYPE_LABEL, shortAddress } from '../../utils/format';

export default function AdminRides() {
  const navigate = useNavigate();
  const [f, setF] = useState({ status: '', rideType: '', paymentStatus: '', q: '', page: 1 });
  const q = useDebounce(f.q, 350);
  const { data, meta, loading, error, reload } = useAsync(
    () => AdminAPI.rides({ page: f.page, status: f.status || undefined, rideType: f.rideType || undefined, paymentStatus: f.paymentStatus || undefined, q: q || undefined }),
    [f.page, f.status, f.rideType, f.paymentStatus, q],
  );
  useSocketEvent('notification:new', () => reload({ silent: true }));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value, page: 1 });

  return (
    <Box>
      <PageHeader title="Rides" subtitle="Every trip on the platform. Click a row for full details." />
      <Card mb={4}><CardBody>
        <Stack direction={{ base: 'column', md: 'row' }} spacing={3}>
          <InputGroup flex="2"><InputLeftElement pointerEvents="none"><Icon as={FiSearch} color="text.muted" /></InputLeftElement><Input placeholder="Search address" value={f.q} onChange={set('q')} aria-label="Search rides" /></InputGroup>
          <Select flex="1" value={f.status} onChange={set('status')} aria-label="Status">
            <option value="">All statuses</option><option value="active">Active</option>
            {['requested', 'accepted', 'arriving', 'in_progress', 'completed', 'cancelled'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </Select>
          <Select flex="1" value={f.rideType} onChange={set('rideType')} aria-label="Ride type"><option value="">All types</option>{Object.entries(RIDE_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
          <Select flex="1" value={f.paymentStatus} onChange={set('paymentStatus')} aria-label="Payment"><option value="">Any payment</option>{['pending', 'paid', 'failed', 'not_required'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</Select>
        </Stack>
      </CardBody></Card>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <LoadingState />}
      {data?.length === 0 && <EmptyState icon={FiMap} title="No rides match" />}
      {data?.length > 0 && (
        <Card><TableContainer>
          <Table>
            <Thead><Tr><Th>When</Th><Th>Route</Th><Th>Rider</Th><Th>Driver</Th><Th>Type</Th><Th>Status</Th><Th>Payment</Th><Th isNumeric>Fare</Th></Tr></Thead>
            <Tbody>
              {data.map((r) => (
                <Tr key={r._id} cursor="pointer" _hover={{ bg: 'bg.subtle' }} onClick={() => navigate(`/ride/${r._id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/ride/${r._id}`)}>
                  <Td whiteSpace="nowrap">{dateTime(r.createdAt)}</Td>
                  <Td maxW="260px"><Text noOfLines={1}>{shortAddress(r.pickup.address)} → {shortAddress(r.dropoff.address)}</Text><Text fontSize="xs" color="text.muted">{r.distanceKm} km{r.stops?.length ? ` · ${r.stops.length} stop(s)` : ''}</Text></Td>
                  <Td>{r.rider?.name}</Td>
                  <Td>{r.driver?.name || <Text as="span" color="text.muted">—</Text>}</Td>
                  <Td>{RIDE_TYPE_LABEL[r.rideType]}</Td>
                  <Td><RideStatusBadge status={r.status} /></Td>
                  <Td><PaymentStatusBadge status={r.paymentStatus} /></Td>
                  <Td isNumeric fontWeight={700}>{money(r.status === 'cancelled' ? r.fare.cancellationFee : r.fare.total)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer></Card>
      )}
      <Pagination meta={meta} onChange={(page) => setF({ ...f, page })} />
    </Box>
  );
}
