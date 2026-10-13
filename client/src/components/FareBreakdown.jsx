import { Divider, Flex, Text, VStack } from '@chakra-ui/react';
import { money } from '../utils/format';

function Row({ label, value, bold, color }) {
  return (
    <Flex justify="space-between" fontSize="sm" fontWeight={bold ? 700 : 400} color={color}>
      <Text>{label}</Text><Text>{value}</Text>
    </Flex>
  );
}

export default function FareBreakdown({ fare, promoCode, cancelled }) {
  if (!fare) return null;
  if (cancelled) {
    return (
      <VStack align="stretch" spacing={2}>
        <Row label="Cancellation fee" value={money(fare.cancellationFee)} bold />
      </VStack>
    );
  }
  return (
    <VStack align="stretch" spacing={2}>
      <Row label="Base fare" value={money(fare.baseFare)} />
      <Row label="Distance" value={money(fare.distanceFare)} />
      <Row label="Time" value={money(fare.timeFare)} />
      {fare.stopsFare > 0 && <Row label="Extra stops" value={money(fare.stopsFare)} />}
      {fare.surgeMultiplier > 1 && <Row label="High demand" value={`×${fare.surgeMultiplier}`} color="accent.700" />}
      <Divider />
      <Row label="Subtotal" value={money(fare.subtotal)} />
      {fare.discount > 0 && <Row label={`Promo ${promoCode || ''}`} value={`− ${money(fare.discount)}`} color="green.600" />}
      <Divider />
      <Row label="Total" value={money(fare.total)} bold />
    </VStack>
  );
}
