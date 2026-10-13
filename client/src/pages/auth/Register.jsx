import { useState } from 'react';
import {
  Alert, AlertIcon, Box, Button, Divider, FormControl, FormErrorMessage, FormLabel, HStack, Input, Link, Select, SimpleGrid, Text, VStack,
  useRadio, useRadioGroup, Icon, Collapse,
} from '@chakra-ui/react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { FiUser, FiTruck } from 'react-icons/fi';
import AuthLayout from '../../layouts/AuthLayout';
import GoogleSignIn from '../../components/GoogleSignIn';
import { useAuth, homeFor } from '../../context/AuthContext';
import { RIDE_TYPE_LABEL } from '../../utils/format';

function RoleCard({ icon, title, text, ...props }) {
  const { getInputProps, getRadioProps } = useRadio(props);
  return (
    <Box as="label" cursor="pointer">
      <input {...getInputProps()} />
      <Box {...getRadioProps()} p={4} borderWidth="2px" borderRadius="lg" borderColor="border.subtle" transition="all .15s"
        _checked={{ borderColor: 'brand.500', bg: 'brand.50' }} _focusVisible={{ boxShadow: 'outline' }}>
        <Icon as={icon} boxSize={5} color="brand.700" mb={2} />
        <Text fontWeight={700} fontSize="sm">{title}</Text>
        <Text fontSize="xs" color="text.muted">{text}</Text>
      </Box>
    </Box>
  );
}

const PLATE_RX = /^[A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{0,3}[ -]?[0-9]{1,4}$/;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    role: params.get('role') === 'driver' ? 'driver' : 'rider', name: '', email: '', phone: '', password: '',
    licenseNumber: '', vehicle: { type: 'mini', make: '', model: '', color: '', plate: '' },
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const { getRootProps, getRadioProps } = useRadioGroup({ name: 'role', value: form.role, onChange: (role) => setForm({ ...form, role }) });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setV = (k) => (e) => setForm({ ...form, vehicle: { ...form.vehicle, [k]: k === 'plate' ? e.target.value.toUpperCase() : e.target.value } });

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Enter your full name';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email address';
    if (!/^\+?[0-9]{10,13}$/.test(form.phone.trim())) e.phone = 'Enter a 10–13 digit phone number';
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) e.password = 'At least 8 characters with a letter and a number';
    if (form.role === 'driver') {
      if (form.licenseNumber.trim().length < 5) e.licenseNumber = 'Enter your driving licence number';
      if (form.vehicle.make.trim().length < 2) e.make = 'Required';
      if (!form.vehicle.model.trim()) e.model = 'Required';
      if (form.vehicle.color.trim().length < 3) e.color = 'Required';
      if (!PLATE_RX.test(form.vehicle.plate.trim())) e.plate = 'e.g. KA01AB1234';
    }
    setErrors(e);
    return !Object.keys(e).length;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const body = { role: form.role, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), password: form.password };
      if (form.role === 'driver') Object.assign(body, { licenseNumber: form.licenseNumber.trim(), vehicle: form.vehicle });
      const user = await register(body);
      navigate(homeFor(user.role), { replace: true });
    } catch (err) {
      setServerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Ride in minutes, or sign up to drive and earn.">
      <VStack as="form" spacing={4} onSubmit={onSubmit} noValidate align="stretch">
        {serverError && <Alert status="error" borderRadius="md"><AlertIcon />{serverError}</Alert>}
        <SimpleGrid columns={2} spacing={3} {...getRootProps()}>
          <RoleCard icon={FiUser} title="I want to ride" text="Book & track rides" {...getRadioProps({ value: 'rider' })} />
          <RoleCard icon={FiTruck} title="I want to drive" text="Accept trips & earn" {...getRadioProps({ value: 'driver' })} />
        </SimpleGrid>
        <FormControl isInvalid={!!errors.name}><FormLabel>Full name</FormLabel><Input autoComplete="name" value={form.name} onChange={set('name')} /><FormErrorMessage>{errors.name}</FormErrorMessage></FormControl>
        <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
          <FormControl isInvalid={!!errors.email}><FormLabel>Email</FormLabel><Input type="email" autoComplete="email" value={form.email} onChange={set('email')} /><FormErrorMessage>{errors.email}</FormErrorMessage></FormControl>
          <FormControl isInvalid={!!errors.phone}><FormLabel>Phone</FormLabel><Input type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="98765 43210" /><FormErrorMessage>{errors.phone}</FormErrorMessage></FormControl>
        </SimpleGrid>
        <FormControl isInvalid={!!errors.password}><FormLabel>Password</FormLabel><Input type="password" autoComplete="new-password" value={form.password} onChange={set('password')} /><FormErrorMessage>{errors.password}</FormErrorMessage></FormControl>

        <Collapse in={form.role === 'driver'} animateOpacity>
          <VStack spacing={4} align="stretch" p={4} borderRadius="lg" bg="bg.subtle">
            <Text fontWeight={700} fontSize="sm">Vehicle & licence</Text>
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
              <FormControl><FormLabel fontSize="sm">Ride category</FormLabel>
                <Select bg="bg.surface" value={form.vehicle.type} onChange={setV('type')}>
                  {Object.entries(RIDE_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </Select>
              </FormControl>
              <FormControl isInvalid={!!errors.licenseNumber}><FormLabel fontSize="sm">Licence number</FormLabel><Input bg="bg.surface" value={form.licenseNumber} onChange={set('licenseNumber')} /><FormErrorMessage>{errors.licenseNumber}</FormErrorMessage></FormControl>
              <FormControl isInvalid={!!errors.make}><FormLabel fontSize="sm">Make</FormLabel><Input bg="bg.surface" value={form.vehicle.make} onChange={setV('make')} placeholder="Maruti Suzuki" /><FormErrorMessage>{errors.make}</FormErrorMessage></FormControl>
              <FormControl isInvalid={!!errors.model}><FormLabel fontSize="sm">Model</FormLabel><Input bg="bg.surface" value={form.vehicle.model} onChange={setV('model')} placeholder="Swift" /><FormErrorMessage>{errors.model}</FormErrorMessage></FormControl>
              <FormControl isInvalid={!!errors.color}><FormLabel fontSize="sm">Colour</FormLabel><Input bg="bg.surface" value={form.vehicle.color} onChange={setV('color')} placeholder="White" /><FormErrorMessage>{errors.color}</FormErrorMessage></FormControl>
              <FormControl isInvalid={!!errors.plate}><FormLabel fontSize="sm">Registration no.</FormLabel><Input bg="bg.surface" value={form.vehicle.plate} onChange={setV('plate')} placeholder="KA01AB1234" /><FormErrorMessage>{errors.plate}</FormErrorMessage></FormControl>
            </SimpleGrid>
          </VStack>
        </Collapse>

        <Button type="submit" size="lg" isLoading={loading}>{form.role === 'driver' ? 'Sign up to drive' : 'Create account'}</Button>
        {form.role === 'rider' && (
          <>
            <HStack><Divider /><Text fontSize="xs" color="text.muted">OR</Text><Divider /></HStack>
            <GoogleSignIn />
          </>
        )}
        <Text fontSize="sm" textAlign="center">Already have an account? <Link as={RouterLink} to="/login" color="brand.700" fontWeight={600}>Log in</Link></Text>
      </VStack>
    </AuthLayout>
  );
}
