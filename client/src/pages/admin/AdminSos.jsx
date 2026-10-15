import { useState } from 'react';
import {
  Badge, Box, Button, Card, CardBody, Flex, Heading, HStack, Link, Select, SimpleGrid, Text, Textarea, useDisclosure, VStack, Icon,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { FiAlertOctagon, FiMapPin, FiPhone, FiCheck } from 'react-icons/fi';
import { EmptyState, ErrorState, LoadingState, PageHeader, Pagination } from '../../components/common';
import ConfirmDialog from '../../components/ConfirmDialog';
import { AdminAPI } from '../../services/endpoints';
import { useAsync } from '../../hooks/useAsync';
import { useApiAction } from '../../hooks/useApiAction';
import { useSocketEvent } from '../../context/SocketContext';
import { dateTime, shortAddress, timeAgo } from '../../utils/format';

const COLOR = { active: 'red', acknowledged: 'orange', resolved: 'green' };

export default function AdminSos() {
  const [f, setF] = useState({ status: '', page: 1 });
  const [target, setTarget] = useState(null);
  const [note, setNote] = useState('');
  const dlg = useDisclosure();
  const { data, meta, loading, error, reload } = useAsync(() => AdminAPI.sos({ page: f.page, status: f.status || undefined }), [f.page, f.status]);
  useSocketEvent('sos:new', () => reload({ silent: true }));
  const [update, updating] = useApiAction(async () => {
    await AdminAPI.resolveSos(target.alert._id, { status: target.status, resolutionNote: note || undefined });
    dlg.onClose();
    setNote('');
    reload({ silent: true });
  }, { success: 'Alert updated' });

  const open = (alert, status) => { setTarget({ alert, status }); dlg.onOpen(); };

  return (
    <Box>
      <PageHeader title="SOS alerts" subtitle="Emergency alerts raised during rides. New alerts appear here instantly."
        actions={<Select value={f.status} onChange={(e) => setF({ status: e.target.value, page: 1 })} w="200px" aria-label="Status"><option value="">All alerts</option><option value="active">Active</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option></Select>} />
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <LoadingState />}
      {data?.length === 0 && <EmptyState icon={FiAlertOctagon} title="No SOS alerts" description="All clear." />}
      <VStack align="stretch" spacing={4}>
        {data?.map((a) => {
          const v = a.ride?.driver?.driver?.vehicle;
          return (
            <Card key={a._id} borderLeftWidth="4px" borderLeftColor={`${COLOR[a.status]}.400`}>
              <CardBody>
                <Flex justify="space-between" gap={4} direction={{ base: 'column', md: 'row' }}>
                  <Box flex="1">
                    <HStack mb={1}><Icon as={FiAlertOctagon} color="red.500" /><Heading size="sm">{a.user?.name}</Heading><Badge colorScheme={COLOR[a.status]}>{a.status}</Badge><Badge variant="outline">{a.user?.role}</Badge></HStack>
                    <Text fontSize="xs" color="text.muted" mb={3}>{dateTime(a.createdAt)} · {timeAgo(a.createdAt)}</Text>
                    {a.message && <Text fontSize="sm" mb={2}>“{a.message}”</Text>}
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2} fontSize="sm">
                      <HStack><Icon as={FiPhone} color="text.muted" /><Link href={`tel:${a.user?.phone}`}>{a.user?.phone}</Link></HStack>
                      {a.location?.lat && <HStack><Icon as={FiMapPin} color="text.muted" /><Link href={`https://maps.google.com/?q=${a.location.lat},${a.location.lng}`} isExternal color="brand.700">{a.location.lat.toFixed(5)}, {a.location.lng.toFixed(5)}</Link></HStack>}
                      {a.ride && <Text>Ride: <Link as={RouterLink} to={`/ride/${a.ride._id}`} color="brand.700">{shortAddress(a.ride.pickup?.address)} → {shortAddress(a.ride.dropoff?.address)}</Link></Text>}
                      {a.ride?.driver && <Text>Driver: {a.ride.driver.name} · {a.ride.driver.phone}{v ? ` · ${v.plate}` : ''}</Text>}
                    </SimpleGrid>
                    <Text fontSize="xs" color="text.muted" mt={2}>
                      Contacts notified: {a.contactsNotified?.length ? a.contactsNotified.map((c) => `${c.name} (${c.deliveryStatus})`).join(', ') : 'none on file'} · Emergency services: {a.emergencyServicesNotified ? 'notified (simulated)' : 'no'}
                    </Text>
                    {a.resolutionNote && <Text fontSize="sm" mt={2} color="green.700">Resolution: {a.resolutionNote}</Text>}
                  </Box>
                  {a.status !== 'resolved' && (
                    <VStack align="stretch" minW="160px">
                      {a.status === 'active' && <Button size="sm" variant="outline" colorScheme="orange" onClick={() => open(a, 'acknowledged')}>Acknowledge</Button>}
                      <Button size="sm" colorScheme="green" leftIcon={<FiCheck />} onClick={() => open(a, 'resolved')}>Resolve</Button>
                    </VStack>
                  )}
                </Flex>
              </CardBody>
            </Card>
          );
        })}
      </VStack>
      <Pagination meta={meta} onChange={(page) => setF({ ...f, page })} />
      <ConfirmDialog isOpen={dlg.isOpen} onClose={dlg.onClose} onConfirm={update} isLoading={updating} colorScheme={target?.status === 'resolved' ? 'green' : 'orange'}
        title={target?.status === 'resolved' ? 'Resolve this alert?' : 'Acknowledge this alert?'} confirmLabel={target?.status === 'resolved' ? 'Resolve' : 'Acknowledge'}>
        <Text fontSize="sm" mb={3}>The user will be notified.</Text>
        <Textarea placeholder="Note (e.g. called the rider, they are safe)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      </ConfirmDialog>
    </Box>
  );
}
