import {
  Badge, Box, Button, Flex, Icon, IconButton, Popover, PopoverBody, PopoverContent, PopoverHeader, PopoverTrigger, Portal, Text, VStack,
} from '@chakra-ui/react';
import { FiBell, FiCreditCard, FiHelpCircle, FiNavigation, FiAlertOctagon, FiGift, FiInfo } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { timeAgo } from '../utils/format';

const ICONS = { ride: FiNavigation, payment: FiCreditCard, support: FiHelpCircle, sos: FiAlertOctagon, promo: FiGift, system: FiInfo };

export default function NotificationBell() {
  const { notifications, unread, markRead, markAllRead } = useSocket();
  const navigate = useNavigate();

  return (
    <Popover placement="bottom-end" isLazy>
      <PopoverTrigger>
        <Box position="relative">
          <IconButton variant="ghost" aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} icon={<FiBell />} />
          {unread > 0 && (
            <Badge position="absolute" top="1" right="1" colorScheme="red" variant="solid" borderRadius="full" fontSize="xs" minW="18px" textAlign="center" pointerEvents="none">
              {unread > 9 ? '9+' : unread}
            </Badge>
          )}
        </Box>
      </PopoverTrigger>
      <Portal>
        <PopoverContent w={{ base: '92vw', sm: '380px' }} boxShadow="raised" _focus={{ outline: 'none' }}>
          <PopoverHeader display="flex" justifyContent="space-between" alignItems="center" fontWeight={700}>
            Notifications
            {unread > 0 && <Button size="xs" variant="ghost" onClick={markAllRead}>Mark all read</Button>}
          </PopoverHeader>
          <PopoverBody p={0} maxH="420px" overflowY="auto">
            {notifications.length === 0 ? (
              <Text p={6} textAlign="center" color="text.muted" fontSize="sm">You&apos;re all caught up.</Text>
            ) : (
              <VStack spacing={0} align="stretch">
                {notifications.map((n) => (
                  <Flex
                    key={n._id}
                    as="button"
                    textAlign="left"
                    gap={3}
                    px={4}
                    py={3}
                    bg={n.read ? 'transparent' : 'brand.50'}
                    _hover={{ bg: 'bg.subtle' }}
                    borderBottomWidth="1px"
                    borderColor="border.subtle"
                    onClick={() => { if (!n.read) markRead(n._id); if (n.link) navigate(n.link); }}
                  >
                    <Icon as={ICONS[n.type] || FiInfo} mt={1} color={n.type === 'sos' ? 'red.500' : 'brand.700'} />
                    <Box flex="1">
                      <Text fontSize="sm" fontWeight={n.read ? 500 : 700}>{n.title}</Text>
                      {n.body && <Text fontSize="xs" color="text.muted" noOfLines={2}>{n.body}</Text>}
                      <Text fontSize="xs" color="text.muted" mt={1}>{timeAgo(n.createdAt)}</Text>
                    </Box>
                  </Flex>
                ))}
              </VStack>
            )}
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  );
}
