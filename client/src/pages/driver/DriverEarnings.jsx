import { Box, Button, Grid, SimpleGrid, Table, Tbody, Td, Text, Th, Thead, Tr, Badge, TableContainer } from '@chakra-ui/react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell, Legend } from 'recharts';
import { FiDollarSign, FiTrendingUp, FiCalendar, FiSend } from 'react-icons/fi';
import { ErrorState, LoadingState, PageHeader, SectionCard, StatCard, EmptyState } from '../../components/common';
import { DriverAPI } from '../../services/endpoints';
import { useAsync } from '../../hooks/useAsync';
import { useApiAction } from '../../hooks/useApiAction';
import { dateOnly, money, shortDay } from '../../utils/format';

const METHOD_COLORS = { cash: '#64748B', upi: '#0D9488', card: '#0F172A', wallet: '#F59E0B' };

export default function DriverEarnings() {
  const { data, loading, error, reload } = useAsync(() => DriverAPI.earnings(), []);
  const [payout, paying] = useApiAction(async () => { const res = await DriverAPI.payout(); await reload({ silent: true }); return res; }, { success: (r) => `Payout of ${money(r.data.amount)} initiated`, errorTitle: 'Payout failed' });

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState rows={4} />;
  const completed = data.trips.find((t) => t._id === 'completed');

  return (
    <Box>
      <PageHeader title="Earnings" subtitle={`You keep 80% of every fare. Cash fares are collected directly; in-app payments are paid out to your bank.`}
        actions={<Button leftIcon={<FiSend />} onClick={payout} isLoading={paying} isDisabled={data.pendingPayout < 1}>Cash out {money(data.pendingPayout)}</Button>} />

      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <StatCard label="Lifetime earnings" value={money(data.totalEarnings)} icon={FiTrendingUp} />
        <StatCard label="This week" value={money(data.week.earnings)} hint={`${data.week.trips} trips`} icon={FiCalendar} />
        <StatCard label="Today" value={money(data.today.earnings)} hint={`${data.today.trips} trips`} icon={FiDollarSign} />
        <StatCard label="Available to cash out" value={money(data.pendingPayout)} hint={`${completed?.count || 0} trips · ${Math.round(completed?.km || 0)} km total`} icon={FiSend} tone="green" />
      </SimpleGrid>

      <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6} mb={6}>
        <SectionCard title="Last 14 days">
          <Box h="280px">
            <ResponsiveContainer>
              <BarChart data={data.series} margin={{ left: -10, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="date" tickFormatter={shortDay} fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                <Tooltip formatter={(v, n) => (n === 'earnings' ? money(v) : v)} labelFormatter={shortDay} cursor={{ fill: '#F1F5F9' }} />
                <Bar dataKey="earnings" fill="#0D9488" radius={[6, 6, 0, 0]} name="earnings" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </SectionCard>
        <SectionCard title="By payment method">
          {data.byMethod.length === 0 ? <EmptyState title="No payments yet" /> : (
            <Box h="280px">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={data.byMethod.map((m) => ({ name: m._id.toUpperCase(), value: Math.round(m.earnings), key: m._id }))} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {data.byMethod.map((m) => <Cell key={m._id} fill={METHOD_COLORS[m._id] || '#94A3B8'} />)}
                  </Pie>
                  <Tooltip formatter={(v) => money(v)} />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          )}
        </SectionCard>
      </Grid>

      <SectionCard title="Payout history">
        {data.payouts.length === 0 ? <Text fontSize="sm" color="text.muted">No payouts yet.</Text> : (
          <TableContainer>
            <Table>
              <Thead><Tr><Th>Date</Th><Th>Amount</Th><Th>Status</Th><Th>Reference</Th></Tr></Thead>
              <Tbody>
                {data.payouts.map((p) => (
                  <Tr key={p._id}><Td>{dateOnly(p.createdAt)}</Td><Td fontWeight={700}>{money(p.amount)}</Td><Td><Badge colorScheme={p.status === 'paid' ? 'green' : 'yellow'}>{p.status}</Badge></Td><Td fontFamily="mono" fontSize="xs">{p.providerRef || '—'}</Td></Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>
    </Box>
  );
}
