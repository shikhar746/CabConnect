import { useState } from 'react';
import { Badge, Box, Card, CardBody, Select, Stack, Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { FiCreditCard } from 'react-icons/fi';
import { EmptyState, ErrorState, LoadingState, PageHeader, Pagination } from '../../components/common';
import { AdminAPI } from '../../services/endpoints';
import { useAsync } from '../../hooks/useAsync';
import { dateTime, money, titleCase } from '../../utils/format';

const STATUS_COLOR = { succeeded: 'green', failed: 'red', pending: 'yellow', refunded: 'purple' };

export default function AdminPayments() {
  const [f, setF] = useState({ status: '', method: '', page: 1 });
  const { data, meta, loading, error, reload } = useAsync(() => AdminAPI.payments({ page: f.page, status: f.status || undefined, method: f.method || undefined }), [f.page, f.status, f.method]);
  return (
    <Box>
      <PageHeader title="Payments" subtitle="Every charge attempt, including failures from the payment gateway." />
      <Card mb={4}><CardBody>
        <Stack direction={{ base: 'column', md: 'row' }} spacing={3}>
          <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value, page: 1 })} aria-label="Status"><option value="">All statuses</option>{Object.keys(STATUS_COLOR).map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select>
          <Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value, page: 1 })} aria-label="Method"><option value="">All methods</option>{['card', 'upi', 'wallet', 'cash'].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}</Select>
        </Stack>
      </CardBody></Card>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <LoadingState />}
      {data?.length === 0 && <EmptyState icon={FiCreditCard} title="No payments" />}
      {data?.length > 0 && (
        <Card><TableContainer>
          <Table>
            <Thead><Tr><Th>Date</Th><Th>Receipt / ref</Th><Th>Rider</Th><Th>Driver</Th><Th>Type</Th><Th>Method</Th><Th>Status</Th><Th isNumeric>Amount</Th><Th isNumeric>Driver share</Th></Tr></Thead>
            <Tbody>
              {data.map((p) => (
                <Tr key={p._id}>
                  <Td whiteSpace="nowrap">{dateTime(p.createdAt)}</Td>
                  <Td><Text as={RouterLink} to={`/ride/${p.ride}`} fontSize="xs" fontFamily="mono" fontWeight={600}>{p.receiptNumber || '—'}</Text><Text fontSize="xs" color="text.muted" fontFamily="mono">{p.providerRef}</Text>{p.failureReason && <Text fontSize="xs" color="red.500">{p.failureReason}</Text>}</Td>
                  <Td>{p.rider?.name}</Td>
                  <Td>{p.driver?.name || '—'}</Td>
                  <Td fontSize="xs">{titleCase(p.kind)}</Td>
                  <Td><Badge variant="outline">{p.method.toUpperCase()}</Badge><Text fontSize="xs" color="text.muted">{p.provider}</Text></Td>
                  <Td><Badge colorScheme={STATUS_COLOR[p.status]}>{p.status}</Badge></Td>
                  <Td isNumeric fontWeight={700}>{money(p.amount)}</Td>
                  <Td isNumeric>{p.driverEarning ? money(p.driverEarning) : '—'}</Td>
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
