import { useEffect, useId, useRef, useState } from 'react';
import {
  Box, Icon, IconButton, Input, InputGroup, InputLeftElement, InputRightElement, List, ListItem, Spinner, Text, HStack,
} from '@chakra-ui/react';
import { FiMapPin, FiX, FiCrosshair } from 'react-icons/fi';
import { MapsAPI } from '../services/endpoints';
import { useDebounce } from '../hooks/useAsync';

/**
 * Address autocomplete backed by /api/maps/search (mock or Google provider).
 * Keyboard: ↑/↓ to move, Enter to choose, Esc to close.
 */
export default function PlaceInput({ label, value, onChange, placeholder, color = 'brand.700', near, onUseMyLocation, isInvalid, autoFocus }) {
  const [text, setText] = useState(value?.address || '');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const q = useDebounce(text, 250);
  const boxRef = useRef(null);
  const listId = `places-${useId()}`;

  useEffect(() => { setText(value?.address || ''); }, [value?.address]);

  useEffect(() => {
    if (!open || q.trim().length < 2 || q === value?.address) { setResults([]); return; }
    let alive = true;
    setLoading(true);
    MapsAPI.search(q, near)
      .then(({ data }) => { if (alive) { setResults(data); setActive(0); } })
      .catch(() => alive && setResults([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [q, open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const choose = (p) => {
    onChange({ address: p.address, lat: p.lat, lng: p.lng });
    setText(p.address);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open || !results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <Box position="relative" ref={boxRef}>
      <InputGroup>
        <InputLeftElement pointerEvents="none"><Icon as={FiMapPin} color={color} /></InputLeftElement>
        <Input
          aria-label={label}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          value={text}
          placeholder={placeholder}
          autoFocus={autoFocus}
          isInvalid={isInvalid}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setText(e.target.value); setOpen(true); if (value) onChange(null); }}
          onKeyDown={onKeyDown}
          bg="bg.surface"
          pr={onUseMyLocation || text ? 16 : 3}
        />
        <InputRightElement w="auto" pr={1}>
          <HStack spacing={0}>
            {loading && <Spinner size="sm" color="brand.500" mr={2} />}
            {onUseMyLocation && !text && (
              <IconButton size="sm" variant="ghost" aria-label="Use my current location" icon={<FiCrosshair />} onClick={onUseMyLocation} />
            )}
            {text && (
              <IconButton size="sm" variant="ghost" aria-label={`Clear ${label}`} icon={<FiX />} onClick={() => { setText(''); onChange(null); setOpen(true); }} />
            )}
          </HStack>
        </InputRightElement>
      </InputGroup>
      {open && (results.length > 0 || (q.length >= 2 && !loading && q !== value?.address)) && (
        <List id={listId} role="listbox" position="absolute" zIndex={20} mt={1} w="100%" bg="bg.surface" borderWidth="1px" borderColor="border.subtle" borderRadius="lg" boxShadow="raised" maxH="280px" overflowY="auto" py={1}>
          {results.length === 0 ? (
            <ListItem px={4} py={3} fontSize="sm" color="text.muted">No places found. Try “MG Road”, “Airport” or “Koramangala”.</ListItem>
          ) : results.map((p, i) => (
            <ListItem
              key={`${p.lat}-${p.lng}`}
              role="option"
              aria-selected={i === active}
              px={4} py={2.5} cursor="pointer"
              bg={i === active ? 'brand.50' : undefined}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); choose(p); }}
            >
              <HStack align="flex-start" spacing={3}>
                <Icon as={FiMapPin} mt={1} color="text.muted" />
                <Box>
                  <Text fontSize="sm" fontWeight={600}>{p.address.split(',')[0]}</Text>
                  <Text fontSize="xs" color="text.muted">{p.address.split(',').slice(1).join(',').trim()}{p.distanceKm !== undefined && ` · ${p.distanceKm} km away`}</Text>
                </Box>
              </HStack>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
