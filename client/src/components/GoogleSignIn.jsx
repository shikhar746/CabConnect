import { useState } from 'react';
import {
  Button, FormControl, FormErrorMessage, FormLabel, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
  Text, useDisclosure, useToast, VStack, Alert, AlertIcon,
} from '@chakra-ui/react';
import { FcGoogle } from 'react-icons/fc';
import { useNavigate } from 'react-router-dom';
import { useAuth, homeFor } from '../context/AuthContext';

/** UTF-8 safe base64url encoding for the mock token. */
const b64url = (obj) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * "Continue with Google". In mock mode (default) a dialog collects a demo Google
 * profile and sends a mock ID token through the same /auth/social endpoint the
 * real Google Identity Services token would use.
 */
export default function GoogleSignIn() {
  const { socialLogin, config } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const modal = useDisclosure();
  const [form, setForm] = useState({ name: '', email: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isMock = !config || config.socialAuthProvider === 'mock';

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(form.email)) { setError('Enter a valid email'); return; }
    setLoading(true);
    try {
      const res = await socialLogin({ provider: 'google', idToken: `mock-google.${b64url({ email: form.email, name: form.name || undefined })}` });
      toast({ title: res.isNew ? 'Account created with Google' : 'Signed in with Google', status: 'success' });
      navigate(homeFor(res.user.role));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onClick = () => {
    if (isMock) { setError(''); modal.onOpen(); return; }
    toast({ title: 'Google sign-in', description: 'Real Google sign-in requires loading Google Identity Services with your GOOGLE_CLIENT_ID (see README).', status: 'info' });
  };

  return (
    <>
      <Button w="100%" variant="outline" colorScheme="gray" leftIcon={<FcGoogle size={18} />} onClick={onClick}>Continue with Google</Button>
      <Modal isOpen={modal.isOpen} onClose={modal.onClose} isCentered>
        <ModalOverlay />
        <ModalContent mx={4}>
          <ModalHeader>Continue with Google</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Alert status="info" borderRadius="md" mb={4} fontSize="sm"><AlertIcon />Demo mode: Google OAuth is simulated. Enter any Google account details.</Alert>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Name</FormLabel>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
              </FormControl>
              <FormControl isInvalid={!!error}>
                <FormLabel>Google email</FormLabel>
                <Input type="email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setError(''); }} placeholder="you@gmail.com" onKeyDown={(e) => e.key === 'Enter' && submit()} />
                <FormErrorMessage>{error}</FormErrorMessage>
              </FormControl>
              <Text fontSize="xs" color="text.muted">New Google accounts are created as rider accounts. Drivers sign up with the form to add vehicle details.</Text>
            </VStack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={modal.onClose}>Cancel</Button>
            <Button onClick={submit} isLoading={loading}>Continue</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
