import { Box, Circle, Flex, Icon, Text } from '@chakra-ui/react';
import { FiCheck } from 'react-icons/fi';
import { dateTime } from '../utils/format';

const STEPS = [
  { key: 'requested', label: 'Requested', at: 'requestedAt' },
  { key: 'accepted', label: 'Driver assigned', at: 'acceptedAt' },
  { key: 'arriving', label: 'Driver arrived', at: 'arrivedAt' },
  { key: 'in_progress', label: 'Trip started', at: 'startedAt' },
  { key: 'completed', label: 'Completed', at: 'completedAt' },
];
const ORDER = STEPS.map((s) => s.key);

export default function RideTimeline({ ride }) {
  const current = ride.status === 'cancelled' ? -1 : ORDER.indexOf(ride.status);
  return (
    <Box>
      {STEPS.map((s, i) => {
        const at = ride.timeline?.[s.at];
        const done = current >= i || (!!at && ride.status !== 'cancelled');
        const isCurrent = current === i && ride.status !== 'completed';
        return (
          <Flex key={s.key} gap={3} position="relative" pb={i < STEPS.length - 1 ? 4 : 0}>
            {i < STEPS.length - 1 && <Box position="absolute" left="11px" top="24px" bottom="0" w="2px" bg={current > i ? 'brand.500' : 'border.subtle'} />}
            <Circle size="24px" bg={done ? 'brand.500' : 'bg.surface'} borderWidth="2px" borderColor={done || isCurrent ? 'brand.500' : 'border.subtle'} flexShrink={0}>
              {done && !isCurrent ? <Icon as={FiCheck} color="white" boxSize={3.5} /> : isCurrent ? <Circle size="8px" bg="brand.500" className="pulse" /> : null}
            </Circle>
            <Box>
              <Text fontSize="sm" fontWeight={isCurrent ? 700 : 500} color={done || isCurrent ? 'ink.900' : 'text.muted'}>{s.label}</Text>
              {at && <Text fontSize="xs" color="text.muted">{dateTime(at)}</Text>}
            </Box>
          </Flex>
        );
      })}
      {ride.status === 'cancelled' && (
        <Text mt={3} fontSize="sm" color="red.500" fontWeight={600}>
          Cancelled {ride.cancelledBy ? `by ${ride.cancelledBy}` : ''} {ride.timeline?.cancelledAt && `· ${dateTime(ride.timeline.cancelledAt)}`}
          {ride.cancelReason && <Text as="span" display="block" fontWeight={400} color="text.muted">“{ride.cancelReason}”</Text>}
        </Text>
      )}
    </Box>
  );
}
