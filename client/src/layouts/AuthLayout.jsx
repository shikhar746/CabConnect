import { Box, Flex, Heading, Text, VStack, Icon, HStack } from '@chakra-ui/react';
import { FiShield, FiNavigation, FiCreditCard } from 'react-icons/fi';
import Logo from '../components/Logo';

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <Flex minH="100vh">
      <Flex flex="1" direction="column" justify="center" px={{ base: 5, md: 12 }} py={10} bg="bg.surface">
        <Box w="100%" maxW="440px" mx="auto">
          <Box mb={10}><Logo /></Box>
          <Heading size="lg" mb={2}>{title}</Heading>
          {subtitle && <Text color="text.muted" mb={8}>{subtitle}</Text>}
          {children}
        </Box>
      </Flex>
      <Flex display={{ base: 'none', lg: 'flex' }} flex="1" bg="ink.900" color="white" direction="column" justify="center" px={16} position="relative" overflow="hidden">
        <Box position="absolute" top="-120px" right="-120px" boxSize="420px" borderRadius="full" bg="brand.700" opacity={0.35} />
        <VStack align="flex-start" spacing={8} position="relative" maxW="md">
          <Heading color="white" size="xl" lineHeight={1.15}>Safe, reliable rides across the city.</Heading>
          {[
            [FiNavigation, 'Real-time driver tracking', 'Know exactly when your ride arrives.'],
            [FiShield, 'Ride PIN & SOS', 'Every trip is verified and one tap away from help.'],
            [FiCreditCard, 'Card, UPI, wallet or cash', 'Pay however you like, receipts emailed instantly.'],
          ].map(([icon, t, d]) => (
            <HStack key={t} align="flex-start" spacing={4}>
              <Flex boxSize={10} borderRadius="lg" bg="whiteAlpha.100" align="center" justify="center" flexShrink={0}><Icon as={icon} color="brand.300" /></Flex>
              <Box><Text fontWeight={600}>{t}</Text><Text color="ink.400" fontSize="sm">{d}</Text></Box>
            </HStack>
          ))}
        </VStack>
      </Flex>
    </Flex>
  );
}
