import {
  Box, Button, Container, Flex, Heading, HStack, Icon, SimpleGrid, Stack, Text, VStack, Badge,
} from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { FiMapPin, FiShield, FiCreditCard, FiStar, FiNavigation, FiPercent, FiUsers, FiClock } from 'react-icons/fi';
import Logo from '../components/Logo';
import { useAuth, homeFor } from '../context/AuthContext';

const FEATURES = [
  { icon: FiNavigation, title: 'Live tracking', text: 'Watch your driver approach in real time with accurate ETAs.' },
  { icon: FiPercent, title: 'Upfront fares', text: 'See the price before you book – promo codes applied instantly.' },
  { icon: FiMapPin, title: 'Multi-stop trips', text: 'Add up to 3 stops on the way, priced transparently.' },
  { icon: FiCreditCard, title: 'Pay your way', text: 'Card, UPI, wallet or cash. Receipts land in your inbox.' },
  { icon: FiShield, title: 'Safety first', text: 'Ride PIN verification and one-tap SOS to your emergency contacts.' },
  { icon: FiStar, title: 'Rated drivers', text: 'Every trip is reviewed, so great drivers rise to the top.' },
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <Box minH="100vh" bg="bg.surface">
      <Box bg="ink.900" color="white" position="relative" overflow="hidden">
        <Container maxW="7xl" py={5}>
          <Flex justify="space-between" align="center">
            <Logo light />
            <HStack>
              {user ? (
                <Button as={Link} to={homeFor(user.role)} colorScheme="brand">Open dashboard</Button>
              ) : (
                <>
                  <Button as={Link} to="/login" variant="ghost" color="white" _hover={{ bg: 'whiteAlpha.200' }}>Log in</Button>
                  <Button as={Link} to="/register">Sign up</Button>
                </>
              )}
            </HStack>
          </Flex>
        </Container>
        <Container maxW="7xl" pt={{ base: 12, md: 20 }} pb={{ base: 16, md: 28 }}>
          <Stack direction={{ base: 'column', lg: 'row' }} spacing={12} align="center">
            <VStack align="flex-start" spacing={6} flex="1">
              <Badge colorScheme="brand" variant="solid" px={3} py={1} borderRadius="full">Now live in Bengaluru</Badge>
              <Heading color="white" fontSize={{ base: '4xl', md: '6xl' }} lineHeight={1.05} fontWeight={800}>
                Your ride, <Text as="span" color="brand.300">on demand.</Text>
              </Heading>
              <Text fontSize={{ base: 'lg', md: 'xl' }} color="ink.300" maxW="lg">
                Book a bike, auto or cab in seconds. Upfront pricing, live tracking and safety features built in.
              </Text>
              <HStack spacing={4} flexWrap="wrap">
                <Button as={Link} to={user ? homeFor(user.role) : '/register'} size="lg" px={8}>Book a ride</Button>
                <Button as={Link} to="/register?role=driver" size="lg" variant="outline" color="white" borderColor="whiteAlpha.400" _hover={{ bg: 'whiteAlpha.100' }}>Drive & earn</Button>
              </HStack>
              <HStack spacing={8} pt={4} color="ink.300" fontSize="sm">
                <HStack><Icon as={FiUsers} /><Text>10k+ riders</Text></HStack>
                <HStack><Icon as={FiStar} /><Text>4.8 avg rating</Text></HStack>
                <HStack><Icon as={FiClock} /><Text>4 min avg pickup</Text></HStack>
              </HStack>
            </VStack>
            <Box flex="1" w="100%" maxW="460px">
              <Box bg="white" color="ink.800" borderRadius="2xl" p={6} boxShadow="2xl">
                <Text fontWeight={700} mb={4}>Where to?</Text>
                <VStack align="stretch" spacing={3}>
                  {[['brand.700', 'MG Road Metro Station'], ['ink.900', 'Kempegowda Intl. Airport']].map(([c, t]) => (
                    <HStack key={t} p={3} borderRadius="lg" bg="ink.50"><Icon as={FiMapPin} color={c} /><Text fontSize="sm">{t}</Text></HStack>
                  ))}
                </VStack>
                <SimpleGrid columns={3} spacing={2} mt={5}>
                  {[['Moto', '₹289'], ['Mini', '₹612'], ['Sedan', '₹748']].map(([l, f], i) => (
                    <Box key={l} p={3} borderRadius="lg" borderWidth="2px" borderColor={i === 1 ? 'brand.500' : 'ink.100'} textAlign="center">
                      <Text fontSize="xs" color="ink.500">{l}</Text>
                      <Text fontWeight={700}>{f}</Text>
                    </Box>
                  ))}
                </SimpleGrid>
                <Button w="100%" mt={5} as={Link} to={user ? homeFor(user.role) : '/login'}>Confirm Mini</Button>
              </Box>
            </Box>
          </Stack>
        </Container>
      </Box>

      <Container maxW="7xl" py={{ base: 14, md: 20 }}>
        <Heading size="xl" textAlign="center" mb={3}>Everything a great ride needs</Heading>
        <Text textAlign="center" color="text.muted" mb={12}>Built for riders, drivers and the team that keeps everyone safe.</Text>
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {FEATURES.map((f) => (
            <Box key={f.title} p={6} borderRadius="card" borderWidth="1px" borderColor="border.subtle" transition="all .2s" _hover={{ boxShadow: 'raised', transform: 'translateY(-2px)' }}>
              <Flex boxSize={11} borderRadius="lg" bg="brand.50" color="brand.700" align="center" justify="center" mb={4}><Icon as={f.icon} boxSize={5} /></Flex>
              <Heading size="sm" mb={2}>{f.title}</Heading>
              <Text color="text.muted" fontSize="sm">{f.text}</Text>
            </Box>
          ))}
        </SimpleGrid>
      </Container>

      <Box borderTopWidth="1px" borderColor="border.subtle" py={8}>
        <Container maxW="7xl"><Flex justify="space-between" align="center" flexWrap="wrap" gap={4}><Logo size="sm" /><Text fontSize="sm" color="text.muted">© {new Date().getFullYear()} CabConnect. Demo application.</Text></Flex></Container>
      </Box>
    </Box>
  );
}
