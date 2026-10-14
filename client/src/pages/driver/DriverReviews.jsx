import { useState } from 'react';
import { Avatar, Box, Flex, Grid, HStack, Progress, Stack, Tag, Text, VStack, Wrap } from '@chakra-ui/react';
import { FiStar } from 'react-icons/fi';
import { EmptyState, ErrorState, LoadingState, PageHeader, Pagination, SectionCard } from '../../components/common';
import { Stars } from '../../components/RatingStars';
import { DriverAPI } from '../../services/endpoints';
import { useAsync } from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { timeAgo } from '../../utils/format';

export default function DriverReviews() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useAsync(() => DriverAPI.reviews({ page, limit: 8 }), [page]);
  const dist = meta?.distribution || [];
  const total = dist.reduce((s, d) => s + d.count, 0);

  return (
    <Box>
      <PageHeader title="Ratings & reviews" subtitle="What riders are saying about your trips." />
      <Grid templateColumns={{ base: '1fr', lg: '320px 1fr' }} gap={6} alignItems="start">
        <SectionCard>
          <VStack spacing={1} mb={5}>
            <Text fontSize="5xl" fontWeight={800} lineHeight={1}>{user.driver?.rating ? user.driver.rating.toFixed(2) : '—'}</Text>
            <Stars value={user.driver?.rating} showValue={false} size={5} />
            <Text fontSize="sm" color="text.muted">{user.driver?.ratingCount || 0} ratings</Text>
          </VStack>
          <Stack spacing={2}>
            {[5, 4, 3, 2, 1].map((s) => {
              const c = dist.find((d) => d._id === s)?.count || 0;
              return (
                <HStack key={s} fontSize="sm">
                  <Text w="20px">{s}★</Text>
                  <Progress flex="1" value={total ? (c / total) * 100 : 0} borderRadius="full" size="sm" colorScheme={s >= 4 ? 'brand' : s === 3 ? 'yellow' : 'red'} aria-label={`${s} star ratings`} />
                  <Text w="28px" textAlign="right" color="text.muted">{c}</Text>
                </HStack>
              );
            })}
          </Stack>
        </SectionCard>
        <Box>
          {error && <ErrorState error={error} onRetry={reload} />}
          {loading && !data && <LoadingState />}
          {data?.length === 0 && <EmptyState icon={FiStar} title="No reviews yet" description="Complete trips to start receiving ratings." />}
          <VStack align="stretch" spacing={3}>
            {data?.map((r) => (
              <SectionCard key={r._id}>
                <Flex gap={3}>
                  <Avatar size="sm" name={r.rider?.name} />
                  <Box flex="1">
                    <HStack justify="space-between"><Text fontWeight={600} fontSize="sm">{r.rider?.name?.split(' ')[0] || 'Rider'}</Text><Text fontSize="xs" color="text.muted">{timeAgo(r.createdAt)}</Text></HStack>
                    <Stars value={r.rating} showValue={false} size={3} />
                    {r.comment && <Text fontSize="sm" mt={2}>{r.comment}</Text>}
                    {r.tags?.length > 0 && <Wrap mt={2}>{r.tags.map((t) => <Tag key={t} size="sm" colorScheme="brand">{t}</Tag>)}</Wrap>}
                  </Box>
                </Flex>
              </SectionCard>
            ))}
          </VStack>
          <Pagination meta={meta} onChange={setPage} />
        </Box>
      </Grid>
    </Box>
  );
}
