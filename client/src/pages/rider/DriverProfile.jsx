import { Avatar, Badge, Box, Button, Flex, Heading, HStack, SimpleGrid, Text, VStack, Wrap, Tag } from '@chakra-ui/react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiStar, FiNavigation, FiCalendar } from 'react-icons/fi';
import { EmptyState, ErrorState, FullPageSpinner, SectionCard, StatCard } from '../../components/common';
import { Stars } from '../../components/RatingStars';
import { DriverAPI } from '../../services/endpoints';
import { assetUrl } from '../../services/api';
import { useAsync } from '../../hooks/useAsync';
import { dateOnly, RIDE_TYPE_LABEL, timeAgo } from '../../utils/format';

export default function DriverProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: d, loading, error, reload } = useAsync(() => DriverAPI.profile(id), [id]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !d) return <FullPageSpinner />;

  return (
    <Box>
      <Button variant="ghost" size="sm" leftIcon={<FiArrowLeft />} mb={3} onClick={() => navigate(-1)}>Back</Button>
      <Flex gap={5} align="center" mb={6} direction={{ base: 'column', sm: 'row' }} textAlign={{ base: 'center', sm: 'left' }}>
        <Avatar size="xl" name={d.name} src={assetUrl(d.avatarUrl)} />
        <Box>
          <Heading size="lg">{d.name}</Heading>
          <HStack mt={1} justify={{ base: 'center', sm: 'flex-start' }}><Stars value={d.rating} count={d.ratingCount} /></HStack>
          <HStack mt={2} spacing={2} justify={{ base: 'center', sm: 'flex-start' }}>
            <Badge colorScheme="brand">{RIDE_TYPE_LABEL[d.vehicle?.type]}</Badge>
            <Text fontSize="sm" color="text.muted">{d.vehicle?.color} {d.vehicle?.make} {d.vehicle?.model} · {d.vehicle?.plate}</Text>
          </HStack>
        </Box>
      </Flex>
      <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={4} mb={6}>
        <StatCard label="Average rating" value={d.rating ? d.rating.toFixed(2) : 'New'} icon={FiStar} tone="accent" />
        <StatCard label="Completed trips" value={d.trips} icon={FiNavigation} />
        <StatCard label="Driving since" value={dateOnly(d.memberSince)} icon={FiCalendar} />
      </SimpleGrid>
      <SectionCard title="Recent reviews">
        {d.reviews.length === 0 ? <EmptyState icon={FiStar} title="No reviews yet" /> : (
          <VStack align="stretch" spacing={4}>
            {d.reviews.map((r) => (
              <Box key={r._id} pb={4} borderBottomWidth="1px" borderColor="border.subtle" _last={{ borderBottom: 'none', pb: 0 }}>
                <HStack justify="space-between"><Stars value={r.rating} showValue={false} /><Text fontSize="xs" color="text.muted">{timeAgo(r.createdAt)}</Text></HStack>
                {r.comment && <Text fontSize="sm" mt={1}>{r.comment}</Text>}
                {r.tags?.length > 0 && <Wrap mt={2}>{r.tags.map((t) => <Tag key={t} size="sm" colorScheme="brand" variant="subtle">{t}</Tag>)}</Wrap>}
                <Text fontSize="xs" color="text.muted" mt={1}>— {r.rider?.name || 'Rider'}</Text>
              </Box>
            ))}
          </VStack>
        )}
      </SectionCard>
    </Box>
  );
}
