import { useRef, useState } from 'react';
import {
  Avatar, Badge, Box, Button, Flex, FormControl, FormErrorMessage, FormLabel, Grid, HStack, Icon, IconButton, Input, Modal, ModalBody,
  ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, SimpleGrid, Stack, Tab, TabList, TabPanel, TabPanels,
  Tabs, Text, useDisclosure, useToast, VStack, Alert, AlertIcon, NumberInput, NumberInputField,
} from '@chakra-ui/react';
import { FiCamera, FiCreditCard, FiPlus, FiSmartphone, FiTrash2, FiUserPlus, FiPhone, FiStar } from 'react-icons/fi';
import { BsWallet2 } from 'react-icons/bs';
import { PageHeader, SectionCard, EmptyState } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import { AuthAPI, ProfileAPI } from '../../services/endpoints';
import { assetUrl } from '../../services/api';
import { useApiAction } from '../../hooks/useApiAction';
import { money, RIDE_TYPE_LABEL } from '../../utils/format';

function PersonalInfo() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '' });
  const [errors, setErrors] = useState({});
  const fileRef = useRef();
  const [save, saving] = useApiAction(async () => { const { data } = await ProfileAPI.update(form); setUser(data); }, { success: 'Profile updated', errorTitle: 'Could not update profile' });
  const [upload, uploading] = useApiAction(async (file) => { const { data } = await ProfileAPI.uploadAvatar(file); setUser(data); }, { success: 'Photo updated', errorTitle: 'Upload failed' });
  const [removePhoto] = useApiAction(async () => { const { data } = await ProfileAPI.removeAvatar(); setUser(data); }, { success: 'Photo removed' });

  const onSave = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Enter your full name';
    if (!/^\+?[0-9]{10,13}$/.test(form.phone.trim())) e.phone = 'Enter a 10–13 digit phone number';
    setErrors(e);
    if (!Object.keys(e).length) save();
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { setErrors({ avatar: 'Image must be under 2 MB' }); return; }
    setErrors({});
    upload(f);
  };

  return (
    <SectionCard title="Personal information">
      <Flex gap={6} direction={{ base: 'column', md: 'row' }}>
        <VStack spacing={3}>
          <Box position="relative">
            <Avatar size="2xl" name={user.name} src={assetUrl(user.avatarUrl)} bg="brand.700" color="white" />
            <IconButton aria-label="Change photo" icon={<FiCamera />} size="sm" borderRadius="full" position="absolute" bottom={1} right={1} isLoading={uploading} onClick={() => fileRef.current.click()} />
          </Box>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFile} />
          {user.avatarUrl && <Button size="xs" variant="ghost" colorScheme="red" onClick={removePhoto}>Remove photo</Button>}
          {errors.avatar && <Text color="red.500" fontSize="xs">{errors.avatar}</Text>}
        </VStack>
        <VStack flex="1" spacing={4} align="stretch">
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <FormControl isInvalid={!!errors.name}><FormLabel>Full name</FormLabel><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><FormErrorMessage>{errors.name}</FormErrorMessage></FormControl>
            <FormControl isInvalid={!!errors.phone}><FormLabel>Phone</FormLabel><Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><FormErrorMessage>{errors.phone}</FormErrorMessage></FormControl>
          </SimpleGrid>
          <FormControl><FormLabel>Email</FormLabel><Input value={user.email} isReadOnly bg="bg.subtle" /></FormControl>
          <HStack justify="flex-end"><Button onClick={onSave} isLoading={saving}>Save changes</Button></HStack>
        </VStack>
      </Flex>
    </SectionCard>
  );
}

function AddPaymentMethodModal({ isOpen, onClose }) {
  const { refreshUser, config } = useAuth();
  const [type, setType] = useState('card');
  const [form, setForm] = useState({ cardNumber: '', exp: '', upiId: '', label: '' });
  const [error, setError] = useState('');
  const [save, saving] = useApiAction(async (body) => { await ProfileAPI.addPaymentMethod(body); await refreshUser(); }, { success: 'Payment method added', errorTitle: 'Could not add payment method' });

  const submit = async () => {
    setError('');
    let body;
    if (type === 'card') {
      const m = form.exp.match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/);
      if (form.cardNumber.replace(/\s/g, '').length < 12) return setError('Enter a valid card number');
      if (!m) return setError('Expiry must be MM/YY');
      const yy = Number(m[2]);
      body = { type, cardNumber: form.cardNumber.replace(/\s/g, ''), expMonth: Number(m[1]), expYear: yy < 100 ? 2000 + yy : yy, label: form.label || undefined };
    } else {
      if (!/^[a-z0-9._-]{2,64}@[a-z]{2,32}$/i.test(form.upiId.trim())) return setError('Enter a valid UPI ID, e.g. name@okaxis');
      body = { type, upiId: form.upiId.trim(), label: form.label || undefined };
    }
    if (await save(body)) { setForm({ cardNumber: '', exp: '', upiId: '', label: '' }); onClose(); }
    return undefined;
  };

  const fmtCard = (v) => v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent mx={4}>
        <ModalHeader>Add payment method</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Select value={type} onChange={(e) => { setType(e.target.value); setError(''); }} aria-label="Payment method type">
              <option value="card">Credit / debit card</option>
              <option value="upi">UPI ID</option>
            </Select>
            {type === 'card' ? (
              <>
                {config?.paymentProvider === 'mock' && <Alert status="info" fontSize="xs" borderRadius="md"><AlertIcon />Demo mode – use test cards like 4242 4242 4242 4242 (success) or 4000 0000 0000 0002 (declined).</Alert>}
                <FormControl><FormLabel>Card number</FormLabel><Input inputMode="numeric" autoComplete="cc-number" value={form.cardNumber} onChange={(e) => setForm({ ...form, cardNumber: fmtCard(e.target.value) })} placeholder="4242 4242 4242 4242" /></FormControl>
                <SimpleGrid columns={2} spacing={3}>
                  <FormControl><FormLabel>Expiry</FormLabel><Input autoComplete="cc-exp" value={form.exp} onChange={(e) => setForm({ ...form, exp: e.target.value })} placeholder="MM/YY" /></FormControl>
                  <FormControl><FormLabel>Nickname</FormLabel><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Work card" /></FormControl>
                </SimpleGrid>
              </>
            ) : (
              <>
                <FormControl><FormLabel>UPI ID</FormLabel><Input value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })} placeholder="name@okaxis" /></FormControl>
                <FormControl><FormLabel>Nickname</FormLabel><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="GPay" /></FormControl>
              </>
            )}
            {error && <Text color="red.500" fontSize="sm">{error}</Text>}
          </VStack>
        </ModalBody>
        <ModalFooter gap={3}><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} isLoading={saving}>Save</Button></ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function Wallet() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const addModal = useDisclosure();
  const [amount, setAmount] = useState('500');
  const sources = user.paymentMethods || [];
  const [picked, setPicked] = useState('');
  // Follow the saved methods: fall back to the default/first one if nothing (or a removed one) is picked.
  const source = sources.some((p) => p._id === picked) ? picked : (sources.find((p) => p.isDefault)?._id || sources[0]?._id || '');
  const sync = refreshUser;

  const [topUp, topping] = useApiAction(async () => { const { data } = await ProfileAPI.topUp({ amount: Number(amount), paymentMethodId: source }); await sync(); return data; }, { success: (r) => `Wallet balance is now ${money(r.walletBalance)}`, errorTitle: 'Top-up failed' });
  const [remove] = useApiAction(async (id) => { await ProfileAPI.removePaymentMethod(id); await sync(); }, { success: 'Payment method removed' });
  const [makeDefault] = useApiAction(async (id) => { await ProfileAPI.setDefaultPaymentMethod(id); await sync(); }, { success: 'Default payment method updated' });

  const onTopUp = () => {
    const n = Number(amount);
    if (!source) { toast({ title: 'Add a card or UPI ID first', status: 'warning' }); return; }
    if (!Number.isInteger(n) || n < 50 || n > 10000) { toast({ title: 'Enter an amount between ₹50 and ₹10,000', status: 'warning' }); return; }
    topUp();
  };

  return (
    <Stack spacing={5}>
      <Grid templateColumns={{ base: '1fr', md: '1fr 1.4fr' }} gap={5}>
        <Box p={6} borderRadius="card" bg="ink.900" color="white" position="relative" overflow="hidden">
          <Box position="absolute" right="-40px" top="-40px" boxSize="160px" borderRadius="full" bg="brand.700" opacity={0.4} />
          <HStack mb={6} position="relative"><Icon as={BsWallet2} /><Text fontWeight={600}>CabConnect Wallet</Text></HStack>
          <Text fontSize="sm" color="ink.300" position="relative">Available balance</Text>
          <Text fontSize="4xl" fontWeight={800} position="relative">{money(user.walletBalance, { decimals: 2 })}</Text>
        </Box>
        <SectionCard title="Add money">
          <VStack align="stretch" spacing={3}>
            <HStack>{[200, 500, 1000].map((v) => <Button key={v} size="sm" variant={Number(amount) === v ? 'solid' : 'outline'} onClick={() => setAmount(String(v))}>₹{v}</Button>)}</HStack>
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
              <NumberInput value={amount} onChange={setAmount} min={50} max={10000}><NumberInputField aria-label="Top-up amount" /></NumberInput>
              <Select value={source} onChange={(e) => setPicked(e.target.value)} aria-label="Pay with" placeholder={sources.length ? undefined : 'No saved methods'}>
                {sources.map((p) => <option key={p._id} value={p._id}>{p.type === 'card' ? `${p.brand?.toUpperCase()} •••• ${p.last4}` : p.upiId}</option>)}
              </Select>
            </SimpleGrid>
            <Button onClick={onTopUp} isLoading={topping} isDisabled={!sources.length}>Top up wallet</Button>
          </VStack>
        </SectionCard>
      </Grid>

      <SectionCard title="Saved payment methods" action={<Button size="sm" leftIcon={<FiPlus />} onClick={addModal.onOpen}>Add</Button>}>
        {sources.length === 0 ? (
          <EmptyState icon={FiCreditCard} title="No saved payment methods" description="Add a card or UPI ID for faster checkout." />
        ) : (
          <VStack align="stretch" spacing={2}>
            {sources.map((p) => (
              <Flex key={p._id} align="center" gap={3} p={3} borderWidth="1px" borderColor="border.subtle" borderRadius="lg">
                <Icon as={p.type === 'card' ? FiCreditCard : FiSmartphone} boxSize={5} color="ink.600" />
                <Box flex="1" minW={0}>
                  <HStack><Text fontWeight={600} fontSize="sm">{p.type === 'card' ? `${p.brand?.toUpperCase()} •••• ${p.last4}` : p.upiId}</Text>{p.isDefault && <Badge colorScheme="brand">Default</Badge>}</HStack>
                  <Text fontSize="xs" color="text.muted">{p.label}{p.type === 'card' && ` · Expires ${String(p.expMonth).padStart(2, '0')}/${p.expYear}`}</Text>
                </Box>
                {!p.isDefault && <Button size="xs" variant="ghost" onClick={() => makeDefault(p._id)}>Make default</Button>}
                <IconButton size="sm" variant="ghost" colorScheme="red" aria-label="Remove payment method" icon={<FiTrash2 />} onClick={() => remove(p._id)} />
              </Flex>
            ))}
          </VStack>
        )}
      </SectionCard>
      <AddPaymentMethodModal isOpen={addModal.isOpen} onClose={addModal.onClose} />
    </Stack>
  );
}

function EmergencyContacts() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', relation: '' });
  const [error, setError] = useState('');
  const [add, adding] = useApiAction(async () => { await ProfileAPI.addContact({ ...form, relation: form.relation || undefined }); await refreshUser(); setForm({ name: '', phone: '', relation: '' }); }, { success: 'Contact added', errorTitle: 'Could not add contact' });
  const [remove] = useApiAction(async (id) => { await ProfileAPI.removeContact(id); await refreshUser(); }, { success: 'Contact removed' });

  const submit = () => {
    if (form.name.trim().length < 2) return setError('Enter a name');
    if (!/^\+?[0-9]{10,13}$/.test(form.phone.trim())) return setError('Enter a valid phone number');
    setError('');
    add();
    return undefined;
  };

  return (
    <SectionCard title="Emergency contacts">
      <Text fontSize="sm" color="text.muted" mb={4}>When you press SOS during a ride, these contacts receive an SMS with your live location and vehicle details.</Text>
      <VStack align="stretch" spacing={2} mb={5}>
        {user.emergencyContacts?.length ? user.emergencyContacts.map((c) => (
          <Flex key={c._id} align="center" gap={3} p={3} borderWidth="1px" borderColor="border.subtle" borderRadius="lg">
            <Avatar size="sm" name={c.name} />
            <Box flex="1"><Text fontWeight={600} fontSize="sm">{c.name} {c.relation && <Text as="span" color="text.muted" fontWeight={400}>· {c.relation}</Text>}</Text><HStack fontSize="xs" color="text.muted"><Icon as={FiPhone} /><Text>{c.phone}</Text></HStack></Box>
            <IconButton size="sm" variant="ghost" colorScheme="red" aria-label={`Remove ${c.name}`} icon={<FiTrash2 />} onClick={() => remove(c._id)} />
          </Flex>
        )) : <Text fontSize="sm" color="orange.600">No emergency contacts yet – add at least one.</Text>}
      </VStack>
      {(user.emergencyContacts?.length || 0) < 5 && (
        <Stack direction={{ base: 'column', md: 'row' }} spacing={3} align={{ md: 'flex-end' }}>
          <FormControl><FormLabel fontSize="sm">Name</FormLabel><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormControl>
          <FormControl><FormLabel fontSize="sm">Phone</FormLabel><Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></FormControl>
          <FormControl><FormLabel fontSize="sm">Relation</FormLabel><Input value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} placeholder="Optional" /></FormControl>
          <Button leftIcon={<FiUserPlus />} onClick={submit} isLoading={adding} flexShrink={0}>Add</Button>
        </Stack>
      )}
      {error && <Text color="red.500" fontSize="sm" mt={2}>{error}</Text>}
    </SectionCard>
  );
}

function Vehicle() {
  const { user, setUser } = useAuth();
  const v = user.driver?.vehicle || {};
  const [form, setForm] = useState({ type: v.type || 'mini', make: v.make || '', model: v.model || '', color: v.color || '', plate: v.plate || '', licenseNumber: user.driver?.licenseNumber || '' });
  const [save, saving] = useApiAction(async () => {
    const { licenseNumber, ...vehicle } = form;
    const { data } = await ProfileAPI.updateVehicle({ vehicle, licenseNumber: licenseNumber || undefined });
    setUser(data);
  }, { success: 'Vehicle updated', errorTitle: 'Could not update vehicle' });
  const f = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: k === 'plate' ? e.target.value.toUpperCase() : e.target.value }) });
  return (
    <SectionCard title="Vehicle & licence" action={<HStack><Icon as={FiStar} color="accent.400" /><Text fontWeight={700}>{user.driver?.rating ? user.driver.rating.toFixed(2) : 'New'}</Text></HStack>}>
      {user.driver?.isBusy && <Alert status="info" mb={4} borderRadius="md" fontSize="sm"><AlertIcon />You can change your vehicle after your current trip.</Alert>}
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
        <FormControl><FormLabel>Ride category</FormLabel><Select {...f('type')}>{Object.entries(RIDE_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></FormControl>
        <FormControl><FormLabel>Make</FormLabel><Input {...f('make')} /></FormControl>
        <FormControl><FormLabel>Model</FormLabel><Input {...f('model')} /></FormControl>
        <FormControl><FormLabel>Colour</FormLabel><Input {...f('color')} /></FormControl>
        <FormControl><FormLabel>Registration no.</FormLabel><Input {...f('plate')} /></FormControl>
        <FormControl><FormLabel>Licence number</FormLabel><Input {...f('licenseNumber')} /></FormControl>
      </SimpleGrid>
      <HStack justify="flex-end" mt={4}><Button onClick={save} isLoading={saving} isDisabled={user.driver?.isBusy}>Save vehicle</Button></HStack>
    </SectionCard>
  );
}

function Security() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [save, saving] = useApiAction(() => AuthAPI.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword }), { success: 'Password changed', errorTitle: 'Could not change password' });
  const submit = async () => {
    if (form.newPassword.length < 8 || !/[A-Za-z]/.test(form.newPassword) || !/\d/.test(form.newPassword)) return setError('New password needs 8+ characters with a letter and a number');
    if (form.newPassword !== form.confirm) return setError('Passwords do not match');
    setError('');
    if (await save()) setForm({ currentPassword: '', newPassword: '', confirm: '' });
    return undefined;
  };
  return (
    <SectionCard title="Change password">
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
        <FormControl><FormLabel>Current password</FormLabel><Input type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></FormControl>
        <FormControl><FormLabel>New password</FormLabel><Input type="password" autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></FormControl>
        <FormControl><FormLabel>Confirm</FormLabel><Input type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></FormControl>
      </SimpleGrid>
      {error && <Text color="red.500" fontSize="sm" mt={2}>{error}</Text>}
      <HStack justify="flex-end" mt={4}><Button onClick={submit} isLoading={saving} isDisabled={!form.currentPassword}>Update password</Button></HStack>
    </SectionCard>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const isDriver = user.role === 'driver';
  return (
    <Box>
      <PageHeader title="Profile" subtitle={isDriver ? 'Manage your details, vehicle and safety contacts.' : 'Manage your details, wallet, payment methods and safety contacts.'} />
      <Tabs variant="soft-rounded" isLazy>
        <TabList mb={5} flexWrap="wrap" gap={2}>
          <Tab>Account</Tab>
          {isDriver ? <Tab>Vehicle</Tab> : <Tab>Wallet & payments</Tab>}
          <Tab>Safety</Tab>
        </TabList>
        <TabPanels>
          <TabPanel p={0}><Stack spacing={5}><PersonalInfo /><Security /></Stack></TabPanel>
          <TabPanel p={0}>{isDriver ? <Vehicle /> : <Wallet />}</TabPanel>
          <TabPanel p={0}><EmergencyContacts /></TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}
