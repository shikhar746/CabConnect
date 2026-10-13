import {
  Avatar, Box, Container, Drawer, DrawerBody, DrawerCloseButton, DrawerContent, DrawerHeader, DrawerOverlay, Flex, HStack, Icon, IconButton,
  Menu, MenuButton, MenuDivider, MenuItem, MenuList, Text, Tooltip, useDisclosure, VStack, Badge,
} from '@chakra-ui/react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import {
  FiMenu, FiNavigation, FiClock, FiUser, FiHelpCircle, FiLogOut, FiGrid, FiDollarSign, FiStar, FiUsers, FiMap, FiTag, FiAlertOctagon, FiMail, FiCreditCard,
} from 'react-icons/fi';
import Logo from '../components/Logo';
import NotificationBell from '../components/NotificationBell';
import { useAuth, homeFor } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { assetUrl } from '../services/api';

const NAV = {
  rider: [
    { to: '/book', label: 'Book a ride', icon: FiNavigation },
    { to: '/history', label: 'My rides', icon: FiClock },
    { to: '/profile', label: 'Profile & wallet', icon: FiUser },
    { to: '/support', label: 'Help & support', icon: FiHelpCircle },
  ],
  driver: [
    { to: '/driver', label: 'Dashboard', icon: FiGrid, end: true },
    { to: '/driver/earnings', label: 'Earnings', icon: FiDollarSign },
    { to: '/driver/history', label: 'Trip history', icon: FiClock },
    { to: '/driver/reviews', label: 'Ratings', icon: FiStar },
    { to: '/profile', label: 'Profile & vehicle', icon: FiUser },
    { to: '/support', label: 'Help & support', icon: FiHelpCircle },
  ],
  admin: [
    { to: '/admin', label: 'Overview', icon: FiGrid, end: true },
    { to: '/admin/rides', label: 'Rides', icon: FiMap },
    { to: '/admin/users', label: 'Users', icon: FiUsers },
    { to: '/admin/payments', label: 'Payments', icon: FiCreditCard },
    { to: '/admin/promos', label: 'Promo codes', icon: FiTag },
    { to: '/admin/support', label: 'Support', icon: FiHelpCircle },
    { to: '/admin/sos', label: 'SOS alerts', icon: FiAlertOctagon },
    { to: '/admin/outbox', label: 'Email & SMS log', icon: FiMail },
  ],
};

function NavItems({ items, onNavigate }) {
  return (
    <VStack align="stretch" spacing={1}>
      {items.map((item) => (
        <Box
          key={item.to}
          as={NavLink}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          display="flex"
          alignItems="center"
          gap={3}
          px={3}
          py={2.5}
          borderRadius="lg"
          fontSize="sm"
          fontWeight={500}
          color="ink.600"
          transition="background .15s, color .15s"
          _hover={{ bg: 'bg.subtle', color: 'ink.900' }}
          sx={{ '&.active': { bg: 'brand.50', color: 'brand.700', fontWeight: 600 } }}
        >
          <Icon as={item.icon} boxSize={5} />
          {item.label}
        </Box>
      ))}
    </VStack>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const drawer = useDisclosure();
  const items = NAV[user.role] || [];

  useEffect(() => { drawer.onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Flex minH="100vh">
      {/* Sidebar (desktop) */}
      <Box as="nav" aria-label="Main" display={{ base: 'none', lg: 'flex' }} flexDir="column" w="250px" flexShrink={0} bg="bg.surface" borderRightWidth="1px" borderColor="border.subtle" px={4} py={5} position="sticky" top={0} h="100vh">
        <Box px={2} mb={8}><Logo to={homeFor(user.role)} /></Box>
        <NavItems items={items} />
        <Box mt="auto" px={3} py={3} borderRadius="lg" bg="bg.subtle">
          <Text fontSize="xs" color="text.muted">Signed in as</Text>
          <Text fontSize="sm" fontWeight={600} noOfLines={1}>{user.name}</Text>
          <Badge mt={1} colorScheme={user.role === 'admin' ? 'purple' : user.role === 'driver' ? 'accent' : 'brand'}>{user.role}</Badge>
        </Box>
      </Box>

      <Flex direction="column" flex="1" minW={0}>
        <Flex as="header" h="64px" align="center" justify="space-between" px={{ base: 4, md: 6 }} bg="bg.surface" borderBottomWidth="1px" borderColor="border.subtle" position="sticky" top={0} zIndex={10}>
          <HStack spacing={3}>
            <IconButton display={{ base: 'inline-flex', lg: 'none' }} variant="ghost" aria-label="Open menu" icon={<FiMenu />} onClick={drawer.onOpen} />
            <Box display={{ base: 'block', lg: 'none' }}><Logo size="sm" to={homeFor(user.role)} /></Box>
          </HStack>
          <HStack spacing={2}>
            <Tooltip label={connected ? 'Live updates connected' : 'Reconnecting…'}>
              <HStack spacing={1.5} px={2} display={{ base: 'none', sm: 'flex' }}>
                <Box boxSize={2} borderRadius="full" bg={connected ? 'green.400' : 'orange.400'} />
                <Text fontSize="xs" color="text.muted">{connected ? 'Live' : 'Offline'}</Text>
              </HStack>
            </Tooltip>
            <NotificationBell />
            <Menu placement="bottom-end">
              <MenuButton aria-label="Account menu" borderRadius="full" _focusVisible={{ boxShadow: 'outline' }}>
                <Avatar size="sm" name={user.name} src={assetUrl(user.avatarUrl)} bg="brand.700" color="white" />
              </MenuButton>
              <MenuList>
                <Box px={3} py={2}>
                  <Text fontWeight={600} fontSize="sm">{user.name}</Text>
                  <Text fontSize="xs" color="text.muted">{user.email}</Text>
                </Box>
                <MenuDivider />
                {user.role !== 'admin' && <MenuItem icon={<FiUser />} onClick={() => navigate('/profile')}>Profile</MenuItem>}
                {user.role !== 'admin' && <MenuItem icon={<FiHelpCircle />} onClick={() => navigate('/support')}>Help & support</MenuItem>}
                <MenuItem icon={<FiLogOut />} color="red.500" onClick={() => { logout(); navigate('/login'); }}>Log out</MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </Flex>

        <Container as="main" maxW="7xl" py={{ base: 5, md: 8 }} px={{ base: 4, md: 8 }} flex="1">
          <Outlet />
        </Container>
      </Flex>

      <Drawer isOpen={drawer.isOpen} placement="left" onClose={drawer.onClose}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader><Logo size="sm" to={homeFor(user.role)} /></DrawerHeader>
          <DrawerBody><NavItems items={items} onNavigate={drawer.onClose} /></DrawerBody>
        </DrawerContent>
      </Drawer>
    </Flex>
  );
}
