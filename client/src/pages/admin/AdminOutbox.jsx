import { useState } from 'react';
import { Badge, Box, Card, CardBody, Collapse, Flex, HStack, Icon, Select, Text, VStack, Alert, AlertIcon } from '@chakra-ui/react';
import { FiMail, FiMessageSquare } from 'react-icons/fi';
import { EmptyState, ErrorState, LoadingState, PageHeader, Pagination } from '../../components/common';
import { AdminAPI } from '../../services/endpoints';
import { useAsync } from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { dateTime } from '../../utils/format';

export default function AdminOutbox() {
  const { config } = useAuth();
  const [f, setF] = useState({ channel: '', page: 1 });
  const [open, setOpen] = useState(null);
  const { data, meta, loading, error, reload } = useAsync(() => AdminAPI.outbox({ page: f.page, channel: f.channel || undefined }), [f.page, f.channel]);
  const mocked = config && (config.emailProvider === 'mock' || config.smsProvider === 'mock');

  return (
    <Box>
      <PageHeader title="Email & SMS log" subtitle="Receipts and SOS messages sent by the platform."
        actions={<Select w="180px" value={f.channel} onChange={(e) => setF({ channel: e.target.value, page: 1 })} aria-label="Channel"><option value="">All channels</option><option value="email">Email</option><option value="sms">SMS</option></Select>} />
      {mocked && <Alert status="info" borderRadius="card" mb={4} fontSize="sm"><AlertIcon />Mock providers are active (email: {config.emailProvider}, SMS: {config.smsProvider}). Messages are recorded here instead of being delivered.</Alert>}
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <LoadingState />}
      {data?.length === 0 && <EmptyState icon={FiMail} title="Nothing sent yet" description="Receipts appear here after a ride is paid." />}
      <VStack align="stretch" spacing={2}>
        {data?.map((m) => (
          <Card key={m._id} as="button" textAlign="left" onClick={() => setOpen(open === m._id ? null : m._id)} aria-expanded={open === m._id}>
            <CardBody py={3}>
              <Flex gap={3} align="center">
                <Icon as={m.channel === 'email' ? FiMail : FiMessageSquare} color={m.channel === 'email' ? 'brand.700' : 'accent.600'} />
                <Box flex="1" minW={0}>
                  <HStack><Text fontWeight={600} fontSize="sm" noOfLines={1}>{m.subject || m.body?.slice(0, 80)}</Text></HStack>
                  <Text fontSize="xs" color="text.muted">To {m.to} · {dateTime(m.createdAt)} · via {m.provider}</Text>
                </Box>
                <Badge colorScheme={m.status === 'sent' ? 'green' : 'red'}>{m.status}</Badge>
              </Flex>
              <Collapse in={open === m._id}>
                <Box mt={3} p={3} bg="bg.subtle" borderRadius="md" fontSize="sm" whiteSpace="pre-wrap">{m.body}{m.error && <Text color="red.500" mt={2}>Error: {m.error}</Text>}</Box>
              </Collapse>
            </CardBody>
          </Card>
        ))}
      </VStack>
      <Pagination meta={meta} onChange={(page) => setF({ ...f, page })} />
    </Box>
  );
}
