import {
  Alert, AlertDescription, AlertIcon, AlertTitle, Badge, Box, Button, Card, CardBody, Center, Flex, Heading, HStack, Icon,
  Skeleton, Spinner, Stack, Text,
} from '@chakra-ui/react';
import { FiAlertTriangle, FiInbox, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { PAYMENT_STATUS_META, RIDE_STATUS_META } from '../utils/format';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <Flex mb={6} gap={4} align={{ base: 'flex-start', md: 'center' }} justify="space-between" direction={{ base: 'column', md: 'row' }}>
      <Box>
        <Heading size="lg">{title}</Heading>
        {subtitle && <Text color="text.muted" mt={1}>{subtitle}</Text>}
      </Box>
      {actions && <HStack spacing={3} flexWrap="wrap">{actions}</HStack>}
    </Flex>
  );
}

export function StatCard({ label, value, hint, icon, tone = 'brand' }) {
  return (
    <Card>
      <CardBody>
        <Flex justify="space-between" align="flex-start">
          <Box>
            <Text fontSize="sm" color="text.muted" fontWeight={500}>{label}</Text>
            <Text fontSize="2xl" fontWeight={700} mt={1} color="ink.900">{value}</Text>
            {hint && <Text fontSize="xs" color="text.muted" mt={1}>{hint}</Text>}
          </Box>
          {icon && (
            <Center boxSize={10} borderRadius="lg" bg={`${tone}.50`} color={`${tone}.600`}>
              <Icon as={icon} boxSize={5} />
            </Center>
          )}
        </Flex>
      </CardBody>
    </Card>
  );
}

export function LoadingState({ rows = 3, label }) {
  return (
    <Stack spacing={3} aria-busy="true" aria-label={label || 'Loading'}>
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} h="72px" borderRadius="card" />)}
    </Stack>
  );
}

export function FullPageSpinner() {
  return <Center h="60vh"><Spinner size="xl" color="brand.500" thickness="3px" /></Center>;
}

export function EmptyState({ icon = FiInbox, title, description, action }) {
  return (
    <Center py={14} px={6} textAlign="center" flexDir="column" borderWidth="1px" borderStyle="dashed" borderColor="border.subtle" borderRadius="card" bg="bg.surface">
      <Center boxSize={14} borderRadius="full" bg="brand.50" color="brand.700" mb={4}><Icon as={icon} boxSize={6} /></Center>
      <Heading size="sm" mb={1}>{title}</Heading>
      {description && <Text color="text.muted" maxW="sm" fontSize="sm">{description}</Text>}
      {action && <Box mt={5}>{action}</Box>}
    </Center>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <Alert status="error" borderRadius="card" variant="subtle" alignItems="flex-start">
      <AlertIcon as={FiAlertTriangle} />
      <Box flex="1">
        <AlertTitle>Couldn&apos;t load this</AlertTitle>
        <AlertDescription fontSize="sm">{error?.message || 'Unexpected error'}</AlertDescription>
      </Box>
      {onRetry && <Button size="sm" variant="outline" colorScheme="red" onClick={() => onRetry()}>Retry</Button>}
    </Alert>
  );
}

export function RideStatusBadge({ status }) {
  const m = RIDE_STATUS_META[status] || { label: status, color: 'gray' };
  return <Badge colorScheme={m.color}>{m.label}</Badge>;
}

export function PaymentStatusBadge({ status }) {
  const m = PAYMENT_STATUS_META[status] || { label: status, color: 'gray' };
  return <Badge variant="subtle" colorScheme={m.color}>{m.label}</Badge>;
}

export function Pagination({ meta, onChange }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <Flex justify="space-between" align="center" mt={4} gap={3} flexWrap="wrap">
      <Text fontSize="sm" color="text.muted">Page {meta.page} of {meta.pages} · {meta.total} results</Text>
      <HStack>
        <Button size="sm" variant="outline" leftIcon={<FiChevronLeft />} isDisabled={meta.page <= 1} onClick={() => onChange(meta.page - 1)}>Previous</Button>
        <Button size="sm" variant="outline" rightIcon={<FiChevronRight />} isDisabled={meta.page >= meta.pages} onClick={() => onChange(meta.page + 1)}>Next</Button>
      </HStack>
    </Flex>
  );
}

export function SectionCard({ title, action, children, ...rest }) {
  return (
    <Card {...rest}>
      <CardBody>
        {(title || action) && (
          <Flex justify="space-between" align="center" mb={4} gap={2}>
            {title && <Heading size="sm">{title}</Heading>}
            {action}
          </Flex>
        )}
        {children}
      </CardBody>
    </Card>
  );
}

export function MockBadge({ show, label = 'Demo mode' }) {
  if (!show) return null;
  return <Badge colorScheme="accent" variant="subtle" fontSize="xs">{label}</Badge>;
}
