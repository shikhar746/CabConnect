import { useState } from 'react';
import {
  Badge, Box, Button, Card, FormControl, FormErrorMessage, FormHelperText, FormLabel, HStack, IconButton, Input, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, SimpleGrid, Switch, Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr,
  useDisclosure, VStack,
} from '@chakra-ui/react';
import { FiEdit2, FiPlus, FiTag, FiTrash2 } from 'react-icons/fi';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/common';
import ConfirmDialog from '../../components/ConfirmDialog';
import { AdminAPI } from '../../services/endpoints';
import { useAsync } from '../../hooks/useAsync';
import { useApiAction } from '../../hooks/useApiAction';
import { dateOnly, money } from '../../utils/format';

const EMPTY = { code: '', description: '', discountType: 'percent', value: '', maxDiscount: '', minFare: '0', expiresAt: '', usageLimit: '', perUserLimit: '1', isActive: true };

function PromoModal({ isOpen, onClose, initial, onSaved }) {
  const [form, setForm] = useState(initial || EMPTY);
  const [errors, setErrors] = useState({});
  const [save, saving] = useApiAction(async (body) => (initial?._id ? AdminAPI.updatePromo(initial._id, body) : AdminAPI.createPromo(body)), { success: 'Promo saved', errorTitle: 'Could not save promo' });
  const set = (k) => (e) => setForm({ ...form, [k]: k === 'code' ? e.target.value.toUpperCase() : e.target.value });

  const submit = async () => {
    const e = {};
    if (!/^[A-Z0-9]{3,20}$/.test(form.code)) e.code = '3–20 letters or numbers';
    const value = Number(form.value);
    if (!(value > 0)) e.value = 'Must be greater than 0';
    if (form.discountType === 'percent' && value > 100) e.value = 'Max 100%';
    setErrors(e);
    if (Object.keys(e).length) return;
    const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
    const res = await save({
      code: form.code, description: form.description || undefined, discountType: form.discountType, value,
      // A cap only makes sense for percentage promos; never send a stale one for flat promos.
      maxDiscount: form.discountType === 'percent' ? num(form.maxDiscount) : null,
      minFare: Number(form.minFare || 0),
      // The promo should stay valid for the whole chosen day (local time), not expire at UTC midnight.
      expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59.999`).toISOString() : null,
      usageLimit: num(form.usageLimit), perUserLimit: Number(form.perUserLimit || 1), isActive: form.isActive,
    });
    if (res) onSaved();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
      <ModalOverlay />
      <ModalContent mx={4}>
        <ModalHeader>{initial?._id ? 'Edit promo code' : 'New promo code'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} w="100%">
              <FormControl isInvalid={!!errors.code}><FormLabel>Code</FormLabel><Input value={form.code} onChange={set('code')} placeholder="SUMMER25" /><FormErrorMessage>{errors.code}</FormErrorMessage></FormControl>
              <FormControl><FormLabel>Type</FormLabel><Select value={form.discountType} onChange={set('discountType')}><option value="percent">Percentage</option><option value="flat">Flat amount</option></Select></FormControl>
              <FormControl isInvalid={!!errors.value}><FormLabel>{form.discountType === 'percent' ? 'Discount %' : 'Discount ₹'}</FormLabel><Input type="number" value={form.value} onChange={set('value')} /><FormErrorMessage>{errors.value}</FormErrorMessage></FormControl>
              <FormControl isDisabled={form.discountType !== 'percent'}><FormLabel>Max discount ₹</FormLabel><Input type="number" value={form.maxDiscount ?? ''} onChange={set('maxDiscount')} placeholder="No cap" /></FormControl>
              <FormControl><FormLabel>Minimum fare ₹</FormLabel><Input type="number" value={form.minFare} onChange={set('minFare')} /></FormControl>
              <FormControl><FormLabel>Expires on</FormLabel><Input type="date" value={form.expiresAt || ''} onChange={set('expiresAt')} /></FormControl>
              <FormControl><FormLabel>Total uses</FormLabel><Input type="number" value={form.usageLimit ?? ''} onChange={set('usageLimit')} placeholder="Unlimited" /></FormControl>
              <FormControl><FormLabel>Uses per rider</FormLabel><Input type="number" min={1} value={form.perUserLimit} onChange={set('perUserLimit')} /></FormControl>
            </SimpleGrid>
            <FormControl><FormLabel>Description</FormLabel><Input value={form.description} onChange={set('description')} placeholder="Shown to riders in the offers list" /><FormHelperText>Max 200 characters</FormHelperText></FormControl>
            <FormControl display="flex" alignItems="center"><FormLabel mb={0}>Active</FormLabel><Switch isChecked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /></FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter gap={3}><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} isLoading={saving}>Save</Button></ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default function AdminPromos() {
  const { data, loading, error, reload } = useAsync(() => AdminAPI.promos(), []);
  const modal = useDisclosure();
  const delDlg = useDisclosure();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [remove, removing] = useApiAction(async () => { await AdminAPI.deletePromo(deleting._id); delDlg.onClose(); reload({ silent: true }); }, { success: 'Promo deleted' });

  const openEdit = (p) => {
    setEditing(p ? { ...p, expiresAt: p.expiresAt ? new Date(p.expiresAt).toLocaleDateString('en-CA') : '', maxDiscount: p.maxDiscount ?? '', usageLimit: p.usageLimit ?? '', value: String(p.value), minFare: String(p.minFare ?? 0), perUserLimit: String(p.perUserLimit ?? 1) } : null);
    modal.onOpen();
  };
  const status = (p) => {
    if (!p.isActive) return ['Inactive', 'gray'];
    if (p.expiresAt && new Date(p.expiresAt) < new Date()) return ['Expired', 'red'];
    if (p.usageLimit && p.usedCount >= p.usageLimit) return ['Used up', 'orange'];
    return ['Active', 'green'];
  };

  return (
    <Box>
      <PageHeader title="Promo codes" subtitle="Create discounts riders can apply before booking." actions={<Button leftIcon={<FiPlus />} onClick={() => openEdit(null)}>New promo</Button>} />
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <LoadingState />}
      {data?.length === 0 && <EmptyState icon={FiTag} title="No promo codes" action={<Button onClick={() => openEdit(null)}>Create one</Button>} />}
      {data?.length > 0 && (
        <Card><TableContainer>
          <Table>
            <Thead><Tr><Th>Code</Th><Th>Discount</Th><Th>Conditions</Th><Th>Usage</Th><Th>Expires</Th><Th>Status</Th><Th /></Tr></Thead>
            <Tbody>
              {data.map((p) => {
                const [label, color] = status(p);
                return (
                  <Tr key={p._id}>
                    <Td><Badge colorScheme="accent" fontSize="sm">{p.code}</Badge><Text fontSize="xs" color="text.muted" maxW="220px" noOfLines={1}>{p.description}</Text></Td>
                    <Td fontWeight={700}>{p.discountType === 'percent' ? `${p.value}%${p.maxDiscount ? ` (max ${money(p.maxDiscount)})` : ''}` : money(p.value)}</Td>
                    <Td fontSize="xs">Min fare {money(p.minFare)}<br />{p.perUserLimit}× per rider</Td>
                    <Td>{p.usedCount}{p.usageLimit ? ` / ${p.usageLimit}` : ''}</Td>
                    <Td>{p.expiresAt ? dateOnly(p.expiresAt) : 'Never'}</Td>
                    <Td><Badge colorScheme={color}>{label}</Badge></Td>
                    <Td><HStack spacing={1}>
                      <IconButton size="sm" variant="ghost" aria-label={`Edit ${p.code}`} icon={<FiEdit2 />} onClick={() => openEdit(p)} />
                      <IconButton size="sm" variant="ghost" colorScheme="red" aria-label={`Delete ${p.code}`} icon={<FiTrash2 />} onClick={() => { setDeleting(p); delDlg.onOpen(); }} />
                    </HStack></Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </TableContainer></Card>
      )}
      {modal.isOpen && <PromoModal isOpen onClose={modal.onClose} initial={editing} onSaved={() => { modal.onClose(); reload({ silent: true }); }} />}
      <ConfirmDialog isOpen={delDlg.isOpen} onClose={delDlg.onClose} onConfirm={remove} isLoading={removing} title={`Delete ${deleting?.code}?`} confirmLabel="Delete">
        Riders will no longer be able to apply this code. Past rides keep their discounts.
      </ConfirmDialog>
    </Box>
  );
}
