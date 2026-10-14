import { useState } from 'react';
import {
  Badge, Box, Button, Card, CardBody, FormControl, FormErrorMessage, FormLabel, Input, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, Stack, Table, Tbody, Td, Text, Textarea, Th, Thead, Tr, useDisclosure,
  VStack, SimpleGrid, Icon, InputGroup, InputLeftElement, TableContainer,
} from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { FiPlus, FiHelpCircle, FiSearch, FiCreditCard, FiBriefcase, FiShield, FiUser } from 'react-icons/fi';
import { EmptyState, ErrorState, LoadingState, PageHeader, Pagination } from '../../components/common';
import { RideAPI, SupportAPI } from '../../services/endpoints';
import { useAsync, useDebounce } from '../../hooks/useAsync';
import { useApiAction } from '../../hooks/useApiAction';
import { dateTime, shortAddress, timeAgo, titleCase } from '../../utils/format';

export const CATEGORIES = [
  { value: 'payment', label: 'Payment issue' },
  { value: 'lost_item', label: 'Lost item' },
  { value: 'driver_behavior', label: 'Driver behaviour' },
  { value: 'ride_issue', label: 'Problem with a ride' },
  { value: 'account', label: 'Account & profile' },
  { value: 'safety', label: 'Safety concern' },
  { value: 'other', label: 'Something else' },
];

export const TICKET_STATUS_COLOR = { open: 'orange', in_progress: 'blue', resolved: 'green', closed: 'gray' };
const PRIORITY_COLOR = { low: 'gray', medium: 'yellow', high: 'red' };

const FAQ = [
  { icon: FiCreditCard, title: 'Payments & refunds', text: 'Refunds for duplicate or failed charges are processed within 3–5 business days.', cat: 'payment' },
  { icon: FiBriefcase, title: 'Lost something?', text: 'Tell us which ride and we will connect you with the driver.', cat: 'lost_item' },
  { icon: FiShield, title: 'Safety', text: 'In an emergency use SOS during your ride or call 112.', cat: 'safety' },
  { icon: FiUser, title: 'Account', text: 'Update your phone, password or payment methods from Profile.', cat: 'account' },
];

function NewTicketModal({ isOpen, onClose, initialCategory, onCreated }) {
  const [form, setForm] = useState({ category: initialCategory || 'ride_issue', subject: '', message: '', rideId: '' });
  const [errors, setErrors] = useState({});
  const { data: rides } = useAsync(() => (isOpen ? RideAPI.list({ limit: 10 }) : Promise.resolve({ data: [] })), [isOpen]);
  const [create, creating] = useApiAction((body) => SupportAPI.create(body), { success: 'Ticket submitted – we will get back to you soon', errorTitle: 'Could not submit ticket' });

  const submit = async () => {
    const e = {};
    if (form.subject.trim().length < 5) e.subject = 'At least 5 characters';
    if (form.message.trim().length < 10) e.message = 'Please describe the issue (10+ characters)';
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = await create({ category: form.category, subject: form.subject.trim(), message: form.message.trim(), rideId: form.rideId || undefined });
    if (res) { onCreated(res.data); setForm({ category: 'ride_issue', subject: '', message: '', rideId: '' }); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent mx={4}>
        <ModalHeader>Contact support</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} w="100%">
              <FormControl><FormLabel>Issue category</FormLabel>
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select>
              </FormControl>
              <FormControl><FormLabel>Related ride (optional)</FormLabel>
                <Select value={form.rideId} onChange={(e) => setForm({ ...form, rideId: e.target.value })} placeholder="Not ride-related">
                  {(rides || []).map((r) => <option key={r._id} value={r._id}>{dateTime(r.createdAt)} · {shortAddress(r.pickup.address)} → {shortAddress(r.dropoff.address)}</option>)}
                </Select>
              </FormControl>
            </SimpleGrid>
            <FormControl isInvalid={!!errors.subject}><FormLabel>Subject</FormLabel><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={120} /><FormErrorMessage>{errors.subject}</FormErrorMessage></FormControl>
            <FormControl isInvalid={!!errors.message}><FormLabel>Describe the issue</FormLabel><Textarea rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={2000} /><FormErrorMessage>{errors.message}</FormErrorMessage></FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter gap={3}><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} isLoading={creating}>Submit ticket</Button></ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default function SupportList({ admin = false }) {
  const navigate = useNavigate();
  const modal = useDisclosure();
  const [category, setCategory] = useState();
  const [filters, setFilters] = useState({ status: '', category: '', q: '', page: 1 });
  const q = useDebounce(filters.q, 350);
  const { data, meta, loading, error, reload } = useAsync(
    () => SupportAPI.list({ page: filters.page, status: filters.status || undefined, category: filters.category || undefined, q: q || undefined }),
    [filters.page, filters.status, filters.category, q],
  );
  const base = admin ? '/admin/support' : '/support';
  const open = (cat) => { setCategory(cat); modal.onOpen(); };

  return (
    <Box>
      <PageHeader title={admin ? 'Support tickets' : 'Help & support'} subtitle={admin ? 'Review and respond to rider and driver issues.' : 'Find answers or raise a ticket with our team.'}
        actions={!admin && <Button leftIcon={<FiPlus />} onClick={() => open(undefined)}>New ticket</Button>} />

      {!admin && (
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={4} mb={6}>
          {FAQ.map((f) => (
            <Card key={f.title} as="button" textAlign="left" onClick={() => open(f.cat)} _hover={{ boxShadow: 'raised', borderColor: 'brand.300' }} transition="all .2s">
              <CardBody>
                <Icon as={f.icon} boxSize={5} color="brand.700" mb={2} />
                <Text fontWeight={700} fontSize="sm">{f.title}</Text>
                <Text fontSize="xs" color="text.muted" mt={1}>{f.text}</Text>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Card mb={4}><CardBody>
        <Stack direction={{ base: 'column', md: 'row' }} spacing={3}>
          <InputGroup flex="2"><InputLeftElement pointerEvents="none"><Icon as={FiSearch} color="text.muted" /></InputLeftElement><Input placeholder="Search by subject" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value, page: 1 })} aria-label="Search tickets" /></InputGroup>
          <Select flex="1" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })} aria-label="Status">
            <option value="">All statuses</option>{['open', 'in_progress', 'resolved', 'closed'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </Select>
          <Select flex="1" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })} aria-label="Category">
            <option value="">All categories</option>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </Stack>
      </CardBody></Card>

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <LoadingState />}
      {data?.length === 0 && <EmptyState icon={FiHelpCircle} title="No tickets" description={admin ? 'Nothing matches these filters.' : 'You have not raised any support tickets.'} />}
      {data?.length > 0 && (
        <Card>
          <TableContainer>
            <Table>
              <Thead><Tr><Th>Subject</Th>{admin && <Th>User</Th>}<Th>Category</Th><Th>Priority</Th><Th>Status</Th><Th>Updated</Th></Tr></Thead>
              <Tbody>
                {data.map((t) => (
                  <Tr key={t._id} cursor="pointer" _hover={{ bg: 'bg.subtle' }} onClick={() => navigate(`${base}/${t._id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`${base}/${t._id}`)}>
                    <Td maxW="320px"><Text as={RouterLink} to={`${base}/${t._id}`} fontWeight={600} noOfLines={1}>{t.subject}</Text></Td>
                    {admin && <Td><Text fontSize="sm">{t.user?.name}</Text><Badge fontSize="xs">{t.user?.role}</Badge></Td>}
                    <Td>{CATEGORIES.find((c) => c.value === t.category)?.label}</Td>
                    <Td><Badge colorScheme={PRIORITY_COLOR[t.priority]}>{t.priority}</Badge></Td>
                    <Td><Badge colorScheme={TICKET_STATUS_COLOR[t.status]}>{titleCase(t.status)}</Badge></Td>
                    <Td color="text.muted">{timeAgo(t.updatedAt)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </Card>
      )}
      <Pagination meta={meta} onChange={(page) => setFilters({ ...filters, page })} />
      {!admin && <NewTicketModal key={category || 'none'} isOpen={modal.isOpen} onClose={modal.onClose} initialCategory={category} onCreated={(t) => { modal.onClose(); navigate(`/support/${t._id}`); }} />}
    </Box>
  );
}
