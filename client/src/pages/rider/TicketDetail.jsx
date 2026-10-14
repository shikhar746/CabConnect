import { useState } from 'react';
import {
  Avatar, Badge, Box, Button, Flex, Grid, HStack, Select, Stack, Text, Textarea, VStack, Link,
} from '@chakra-ui/react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiSend } from 'react-icons/fi';
import { ErrorState, FullPageSpinner, SectionCard } from '../../components/common';
import { SupportAPI } from '../../services/endpoints';
import { useAsync } from '../../hooks/useAsync';
import { useApiAction } from '../../hooks/useApiAction';
import { useAuth } from '../../context/AuthContext';
import { CATEGORIES, TICKET_STATUS_COLOR } from './SupportList';
import { dateTime, shortAddress, titleCase, money } from '../../utils/format';

export default function TicketDetail({ admin = false }) {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: t, error, loading, reload, setData } = useAsync(() => SupportAPI.get(id), [id]);
  const [body, setBody] = useState('');
  const [send, sending] = useApiAction(async () => { const { data } = await SupportAPI.message(id, body.trim()); setData(data); setBody(''); }, { errorTitle: 'Could not send message' });
  const [update, updating] = useApiAction(async (patch) => { const { data } = await SupportAPI.update(id, patch); setData(data); }, { success: 'Ticket updated' });

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !t) return <FullPageSpinner />;
  const closed = t.status === 'closed';

  return (
    <Box>
      <Button variant="ghost" size="sm" leftIcon={<FiArrowLeft />} mb={3} onClick={() => navigate(admin ? '/admin/support' : '/support')}>All tickets</Button>
      <Grid templateColumns={{ base: '1fr', lg: '1fr 320px' }} gap={6} alignItems="start">
        <SectionCard title={t.subject} action={<Badge colorScheme={TICKET_STATUS_COLOR[t.status]}>{titleCase(t.status)}</Badge>}>
          <VStack align="stretch" spacing={4} mb={5}>
            {t.messages.map((m) => {
              const mine = String(m.author?._id) === String(user._id);
              const fromSupport = m.authorRole === 'admin';
              return (
                <Flex key={m._id} gap={3} direction={mine ? 'row-reverse' : 'row'}>
                  <Avatar size="sm" name={fromSupport ? 'Support' : m.author?.name} bg={fromSupport ? 'brand.700' : 'ink.400'} color="white" />
                  <Box maxW="80%" bg={mine ? 'brand.700' : 'bg.subtle'} color={mine ? 'white' : 'ink.800'} px={4} py={3} borderRadius="xl">
                    <Text fontSize="xs" fontWeight={700} opacity={0.85} mb={1}>{fromSupport ? `CabConnect Support${m.author?.name ? ` · ${m.author.name}` : ''}` : m.author?.name}</Text>
                    <Text fontSize="sm" whiteSpace="pre-wrap">{m.body}</Text>
                    <Text fontSize="xs" opacity={0.7} mt={1}>{dateTime(m.createdAt)}</Text>
                  </Box>
                </Flex>
              );
            })}
          </VStack>
          {closed ? (
            <Text fontSize="sm" color="text.muted">This ticket is closed. {!admin && <Link as={RouterLink} to="/support" color="brand.700">Open a new ticket</Link>}</Text>
          ) : (
            <Stack>
              <Textarea placeholder={admin ? 'Reply to the user…' : 'Add a message…'} value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && body.trim()) send(); }} />
              <HStack justify="space-between">
                <Text fontSize="xs" color="text.muted">Ctrl + Enter to send</Text>
                <Button leftIcon={<FiSend />} onClick={send} isLoading={sending} isDisabled={!body.trim()}>Send</Button>
              </HStack>
            </Stack>
          )}
        </SectionCard>

        <Stack spacing={4}>
          <SectionCard title="Details">
            <VStack align="stretch" spacing={2} fontSize="sm">
              <Flex justify="space-between"><Text color="text.muted">Category</Text><Text>{CATEGORIES.find((c) => c.value === t.category)?.label}</Text></Flex>
              <Flex justify="space-between"><Text color="text.muted">Priority</Text><Text textTransform="capitalize">{t.priority}</Text></Flex>
              <Flex justify="space-between"><Text color="text.muted">Opened</Text><Text>{dateTime(t.createdAt)}</Text></Flex>
              {admin && <Flex justify="space-between"><Text color="text.muted">User</Text><Text>{t.user?.name} ({t.user?.role})</Text></Flex>}
              {admin && <Flex justify="space-between"><Text color="text.muted">Contact</Text><Text>{t.user?.phone || t.user?.email}</Text></Flex>}
            </VStack>
          </SectionCard>
          {t.ride && (
            <SectionCard title="Linked ride">
              <Text fontSize="sm">{shortAddress(t.ride.pickup.address)} → {shortAddress(t.ride.dropoff.address)}</Text>
              <Text fontSize="xs" color="text.muted">{dateTime(t.ride.createdAt)} · {money(t.ride.fare?.total)} · {titleCase(t.ride.status)}</Text>
              <Button as={RouterLink} to={`/ride/${t.ride._id}`} size="sm" variant="link" mt={2}>View ride</Button>
            </SectionCard>
          )}
          {admin && (
            <SectionCard title="Manage">
              <VStack align="stretch" spacing={3}>
                <Select value={t.status} onChange={(e) => update({ status: e.target.value })} isDisabled={updating} aria-label="Status">
                  {['open', 'in_progress', 'resolved', 'closed'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                </Select>
                <Select value={t.priority} onChange={(e) => update({ priority: e.target.value })} isDisabled={updating} aria-label="Priority">
                  {['low', 'medium', 'high'].map((s) => <option key={s} value={s}>{titleCase(s)} priority</option>)}
                </Select>
              </VStack>
            </SectionCard>
          )}
          {!admin && t.status === 'resolved' && (
            <Text fontSize="sm" color="text.muted">Marked resolved by support. Reply above if you still need help and the ticket will reopen.</Text>
          )}
        </Stack>
      </Grid>
    </Box>
  );
}
