import { useState } from 'react';
import { Button, Text, Textarea, VStack, Wrap, WrapItem, Tag, TagLabel } from '@chakra-ui/react';
import { StarInput } from './RatingStars';
import { RideAPI } from '../services/endpoints';
import { useApiAction } from '../hooks/useApiAction';

const TAGS = ['Safe driving', 'Clean car', 'On time', 'Polite', 'Navigation', 'Great conversation', 'Smooth ride', 'Helpful'];
const LABELS = ['', 'Terrible', 'Bad', 'Okay', 'Good', 'Excellent'];

export default function RatingForm({ rideId, driverName, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState([]);
  const [submit, loading] = useApiAction(() => RideAPI.review(rideId, { rating, comment: comment.trim() || undefined, tags }), { success: 'Thanks for your feedback!', errorTitle: 'Could not submit rating' });

  const toggle = (t) => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]);

  return (
    <VStack align="stretch" spacing={3}>
      <Text fontSize="sm" color="text.muted">How was your ride with {driverName}?</Text>
      <StarInput value={rating} onChange={setRating} />
      {rating > 0 && <Text fontWeight={600} fontSize="sm">{LABELS[rating]}</Text>}
      {rating >= 4 && (
        <Wrap>
          {TAGS.map((t) => (
            <WrapItem key={t}>
              <Tag as="button" type="button" size="md" borderRadius="full" variant={tags.includes(t) ? 'solid' : 'outline'} colorScheme="brand" onClick={() => toggle(t)} aria-pressed={tags.includes(t)}>
                <TagLabel>{t}</TagLabel>
              </Tag>
            </WrapItem>
          ))}
        </Wrap>
      )}
      <Textarea placeholder="Share more about your trip (optional)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={3} />
      <Button isDisabled={!rating} isLoading={loading} onClick={async () => { if (await submit()) onDone?.(); }}>Submit rating</Button>
    </VStack>
  );
}
