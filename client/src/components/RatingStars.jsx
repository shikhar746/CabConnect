import { HStack, Icon, IconButton, Text } from '@chakra-ui/react';
import { FaStar, FaRegStar, FaStarHalfAlt } from 'react-icons/fa';

/** Read-only star display with optional numeric value. */
export function Stars({ value = 0, count, size = 3.5, showValue = true }) {
  const stars = [1, 2, 3, 4, 5].map((i) => {
    const icon = value >= i ? FaStar : value >= i - 0.5 ? FaStarHalfAlt : FaRegStar;
    return <Icon key={i} as={icon} color="accent.400" boxSize={size} />;
  });
  return (
    <HStack spacing={0.5} aria-label={`Rated ${value || 0} out of 5`}>
      {stars}
      {showValue && <Text fontSize="sm" fontWeight={600} ml={1.5}>{value ? Number(value).toFixed(1) : 'New'}</Text>}
      {count !== undefined && <Text fontSize="sm" color="text.muted">({count})</Text>}
    </HStack>
  );
}

/** Interactive 1–5 star input (keyboard accessible buttons). */
export function StarInput({ value, onChange, size = 8 }) {
  return (
    <HStack spacing={1} role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <IconButton
          key={i}
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i > 1 ? 's' : ''}`}
          variant="ghost"
          size="lg"
          icon={<Icon as={value >= i ? FaStar : FaRegStar} boxSize={size} color={value >= i ? 'accent.400' : 'ink.300'} />}
          onClick={() => onChange(i)}
          _hover={{ transform: 'scale(1.1)' }}
          transition="transform .15s"
        />
      ))}
    </HStack>
  );
}
