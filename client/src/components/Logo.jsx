import { HStack, Text, Box } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

export default function Logo({ to = '/', light = false, size = 'md' }) {
  const box = size === 'sm' ? 7 : 9;
  return (
    <HStack as={RouterLink} to={to} spacing={2} _hover={{ textDecoration: 'none' }} aria-label="CabConnect home">
      <Box as="img" src="/favicon.svg" alt="" boxSize={box} />
      <Text fontWeight={800} fontSize={size === 'sm' ? 'lg' : 'xl'} letterSpacing="-0.03em" color={light ? 'white' : 'ink.900'}>
        Cab<Text as="span" color={light ? 'brand.200' : 'brand.700'}>Connect</Text>
      </Text>
    </HStack>
  );
}
