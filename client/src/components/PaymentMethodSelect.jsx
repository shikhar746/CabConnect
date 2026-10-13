import { Box, HStack, Icon, Radio, RadioGroup, Stack, Text, Badge } from '@chakra-ui/react';
import { FiCreditCard, FiSmartphone, FiDollarSign } from 'react-icons/fi';
import { BsWallet2 } from 'react-icons/bs';
import { money } from '../utils/format';

/** Value format: "cash" | "wallet" | "card:<id>" | "upi:<id>" */
export const parsePaymentValue = (v = 'cash') => {
  const [method, paymentMethodId] = v.split(':');
  return { method, paymentMethodId };
};

export function defaultPaymentValue(user) {
  const def = user?.paymentMethods?.find((p) => p.isDefault);
  return def ? `${def.type}:${def._id}` : 'cash';
}

export default function PaymentMethodSelect({ user, value, onChange, allowCash = true, amount, afterTrip = false }) {
  const options = [
    ...(user?.paymentMethods || []).map((p) => ({
      value: `${p.type}:${p._id}`,
      icon: p.type === 'card' ? FiCreditCard : FiSmartphone,
      title: p.type === 'card' ? `${(p.brand || 'card').toUpperCase()} •••• ${p.last4}` : p.upiId,
      sub: p.type === 'card' ? `${p.label || 'Card'} · exp ${String(p.expMonth).padStart(2, '0')}/${String(p.expYear).slice(-2)}` : `UPI${p.label && p.label !== p.upiId ? ` · ${p.label}` : ''}`,
      isDefault: p.isDefault,
    })),
    {
      value: 'wallet', icon: BsWallet2, title: 'CabConnect Wallet', sub: `Balance ${money(user?.walletBalance)}`,
      warn: amount !== undefined && (user?.walletBalance || 0) < amount ? 'Insufficient balance' : undefined,
    },
    ...(allowCash ? [{ value: 'cash', icon: FiDollarSign, title: 'Cash', sub: afterTrip ? 'Paid to the driver directly' : 'Pay the driver at drop-off' }] : []),
  ];

  return (
    <RadioGroup value={value} onChange={onChange}>
      <Stack spacing={2}>
        {options.map((o) => (
          <Box key={o.value} as="label" display="block" cursor="pointer" px={3} py={2.5} borderWidth="1px" borderRadius="lg"
            borderColor={value === o.value ? 'brand.500' : 'border.subtle'} bg={value === o.value ? 'brand.50' : 'bg.surface'} transition="all .15s">
            <HStack spacing={3}>
              <Radio value={o.value} />
              <Icon as={o.icon} color="ink.600" />
              <Box flex="1" minW={0}>
                <HStack spacing={2}>
                  <Text fontSize="sm" fontWeight={600} noOfLines={1}>{o.title}</Text>
                  {o.isDefault && <Badge colorScheme="brand" fontSize="xs">Default</Badge>}
                </HStack>
                <Text fontSize="xs" color={o.warn ? 'red.500' : 'text.muted'}>{o.warn || o.sub}</Text>
              </Box>
            </HStack>
          </Box>
        ))}
      </Stack>
    </RadioGroup>
  );
}
