import { Button, Center, Heading, Text, VStack } from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';

export default function NotFound() {
  return (
    <Center minH="100vh" px={6}>
      <VStack spacing={4} textAlign="center">
        <Logo />
        <Heading size="2xl" color="brand.700">404</Heading>
        <Heading size="md">This road doesn&apos;t lead anywhere</Heading>
        <Text color="text.muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</Text>
        <Button as={Link} to="/">Back to home</Button>
      </VStack>
    </Center>
  );
}
