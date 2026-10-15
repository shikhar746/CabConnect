import { Box, Grid, SimpleGrid, Table, Tbody, Td, Text, Th, Thead, Tr, Badge, TableContainer, HStack, Button, Alert, AlertIcon } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts';
import { FiUsers, FiTruck, FiNavigation, FiDollarSign, FiHelpCircle, FiAlertOctagon, FiActivity } from 'react-icons/fi';
import { ErrorState, LoadingState, PageHeader, SectionCard, StatCard } from '../../components/common';
import { AdminAPI } from '../../services/endpoints';
import { useAsync } from '../../hooks/useAsync';
import { useSocketEvent } from '../../context/SocketContext';
import { money, RIDE_TYPE_LABEL, shortDay } from '../../utils/format';

export default function AdminOverview() {
  const { data, loading, error, reload } = useAsync(() => AdminAPI.stats(), []);
  useSocketEvent('sos:new', () => reload({ silent: true }));

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState rows={5} />;
  const completed = data.rides.completed || 0;
  const cancelled = data.rides.cancelled || 0;
  const cancelRate = completed + cancelled ? Math.round((cancelled / (completed + cancelled)) * 100) : 0;

  return (
    <Box>
      <PageHeader title="Operations overview" subtitle="Live health of the CabConnect marketplace." actions={<Button variant="outline" onClick={() => reload()}>Refresh</Button>} />

      {data.activeSos > 0 && (
        <Alert status="error" borderRadius="card" mb={5}>
          <AlertIcon />
          <Box flex="1"><b>{data.activeSos} active SOS alert{data.activeSos > 1 ? 's' : ''}</b> need attention.</Box>
          <Button as={RouterLink} to="/admin/sos" size="sm" colorScheme="red">Review now</Button>
        </Alert>
      )}

      <SimpleGrid columns={{ base: 2, md: 3, xl: 6 }} spacing={4} mb={6}>
        <StatCard label="Gross bookings" value={money(data.revenue.gross)} icon={FiDollarSign} />
        <StatCard label="Platform revenue" value={money(data.revenue.platform)} icon={FiActivity} tone="green" />
        <StatCard label="Active rides" value={data.activeRides} icon={FiNavigation} tone="accent" />
        <StatCard label="Riders" value={data.users.riders} icon={FiUsers} />
        <StatCard label="Drivers online" value={`${data.users.onlineDrivers}/${data.users.drivers}`} icon={FiTruck} />
        <StatCard label="Open tickets" value={data.openTickets} icon={FiHelpCircle} tone="red" hint={<RouterLink to="/admin/support">View →</RouterLink>} />
      </SimpleGrid>

      <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={6} mb={6}>
        <SectionCard title="Rides – last 14 days">
          <Box h="280px">
            <ResponsiveContainer>
              <BarChart data={data.series} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="date" tickFormatter={shortDay} fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip labelFormatter={shortDay} cursor={{ fill: '#F1F5F9' }} />
                <Legend iconType="circle" />
                <Bar dataKey="completed" stackId="a" fill="#0D9488" name="Completed" />
                <Bar dataKey="cancelled" stackId="a" fill="#F87171" name="Cancelled" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </SectionCard>
        <SectionCard title="Rides by status">
          <Box>
            {['requested', 'accepted', 'arriving', 'in_progress', 'completed', 'cancelled'].map((s) => (
              <HStack key={s} justify="space-between" py={2} borderBottomWidth="1px" borderColor="border.subtle" _last={{ borderBottom: 'none' }}>
                <Text fontSize="sm" textTransform="capitalize">{s.replace('_', ' ')}</Text>
                <Text fontWeight={700}>{data.rides[s] || 0}</Text>
              </HStack>
            ))}
            <Text fontSize="xs" color="text.muted" mt={3}>Cancellation rate: {cancelRate}%</Text>
          </Box>
        </SectionCard>
      </Grid>

      <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={6}>
        <SectionCard title="Paid revenue – last 14 days">
          <Box h="260px">
            <ResponsiveContainer>
              <AreaChart data={data.series} margin={{ left: -5, right: 8 }}>
                <defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14B8A6" stopOpacity={0.35} /><stop offset="100%" stopColor="#14B8A6" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="date" tickFormatter={shortDay} fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                <Tooltip formatter={(v) => money(v)} labelFormatter={shortDay} />
                <Area type="monotone" dataKey="revenue" stroke="#0D9488" strokeWidth={2} fill="url(#rev)" name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </SectionCard>
        <Box>
          <SectionCard title="Top drivers" mb={6}>
            <TableContainer>
              <Table size="sm">
                <Thead><Tr><Th>Driver</Th><Th isNumeric>Rating</Th><Th isNumeric>Earned</Th></Tr></Thead>
                <Tbody>
                  {data.topDrivers.map((d) => (
                    <Tr key={d._id}>
                      <Td><Text as={RouterLink} to={`/drivers/${d._id}`} fontWeight={600}>{d.name}</Text><Text fontSize="xs" color="text.muted">{RIDE_TYPE_LABEL[d.driver?.vehicle?.type]}</Text></Td>
                      <Td isNumeric>{d.driver?.rating ? `${d.driver.rating.toFixed(1)}★` : '—'}</Td>
                      <Td isNumeric>{money(d.driver?.totalEarnings)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          </SectionCard>
          <SectionCard title="Completed trips by type">
            {data.byType.map((t) => (
              <HStack key={t._id} justify="space-between" py={1.5}>
                <Badge colorScheme="brand">{RIDE_TYPE_LABEL[t._id]}</Badge>
                <Text fontSize="sm">{t.count} trips · {money(t.revenue)}</Text>
              </HStack>
            ))}
          </SectionCard>
        </Box>
      </Grid>
      <Box h={2} />
      {data.activeSos === 0 && <Text fontSize="xs" color="text.muted"><FiAlertOctagon style={{ display: 'inline', marginRight: 4 }} />No active SOS alerts.</Text>}
    </Box>
  );
}
