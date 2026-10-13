import { useState } from 'react';
import {
  Alert, AlertIcon, Box, Button, Divider, FormControl, FormErrorMessage, FormLabel, HStack, Input, InputGroup, InputRightElement, IconButton,
  Link, SimpleGrid, Text, VStack,
} from '@chakra-ui/react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import AuthLayout from '../../layouts/AuthLayout';
import GoogleSignIn from '../../components/GoogleSignIn';
import { useAuth, homeFor } from '../../context/AuthContext';

const DEMO = [
  { label: 'Rider', email: 'rider@cabconnect.dev' },
  { label: 'Driver', email: 'driver@cabconnect.dev' },
  { label: 'Admin', email: 'admin@cabconnect.dev' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.identifier.trim()) e.identifier = 'Enter your email or phone number';
    if (!form.password) e.password = 'Enter your password';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const doLogin = async (identifier, password) => {
    setServerError('');
    setLoading(true);
    try {
      const user = await login(identifier.trim(), password);
      const from = location.state?.from;
      navigate(from && from !== '/login' ? from : homeFor(user.role), { replace: true });
    } catch (err) {
      setServerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (validate()) doLogin(form.identifier, form.password);
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to book rides, drive or manage operations.">
      <VStack as="form" spacing={5} onSubmit={onSubmit} noValidate align="stretch">
        {serverError && <Alert status="error" borderRadius="md"><AlertIcon />{serverError}</Alert>}
        <FormControl isInvalid={!!errors.identifier}>
          <FormLabel>Email or phone</FormLabel>
          <Input autoComplete="username" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} placeholder="you@example.com" size="lg" />
          <FormErrorMessage>{errors.identifier}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.password}>
          <FormLabel>Password</FormLabel>
          <InputGroup size="lg">
            <Input type={show ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            <InputRightElement><IconButton size="sm" variant="ghost" aria-label={show ? 'Hide password' : 'Show password'} icon={show ? <FiEyeOff /> : <FiEye />} onClick={() => setShow(!show)} /></InputRightElement>
          </InputGroup>
          <FormErrorMessage>{errors.password}</FormErrorMessage>
        </FormControl>
        <Button type="submit" size="lg" isLoading={loading}>Log in</Button>
        <HStack><Divider /><Text fontSize="xs" color="text.muted" whiteSpace="nowrap">OR</Text><Divider /></HStack>
        <GoogleSignIn />
        <Text fontSize="sm" textAlign="center">New to CabConnect? <Link as={RouterLink} to="/register" color="brand.700" fontWeight={600}>Create an account</Link></Text>
      </VStack>

      <Box mt={8} p={4} borderRadius="lg" bg="bg.subtle">
        <Text fontSize="xs" fontWeight={700} color="text.muted" mb={2} textTransform="uppercase" letterSpacing="wider">Demo accounts · password Password@123</Text>
        <SimpleGrid columns={3} spacing={2}>
          {DEMO.map((d) => (
            <Button key={d.label} size="sm" variant="outline" bg="bg.surface" isDisabled={loading} onClick={() => doLogin(d.email, 'Password@123')}>{d.label}</Button>
          ))}
        </SimpleGrid>
      </Box>
    </AuthLayout>
  );
}
