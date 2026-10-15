import { useState } from 'react';
import {
  Avatar, Badge, Box, Button, Card, CardBody, HStack, Icon, Input, InputGroup, InputLeftElement, Select, Stack, Table, TableContainer, Tbody,
  Td, Text, Th, Thead, Tr, useDisclosure,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { FiSearch, FiUsers } from 'react-icons/fi';
import { EmptyState, ErrorState, LoadingState, PageHeader, Pagination } from '../../components/common';
import ConfirmDialog from '../../components/ConfirmDialog';
import { AdminAPI } from '../../services/endpoints';
import { assetUrl } from '../../services/api';
import { useAsync, useDebounce } from '../../hooks/useAsync';
import { useApiAction } from '../../hooks/useApiAction';
import { useAuth } from '../../context/AuthContext';
import { dateOnly, money, RIDE_TYPE_LABEL } from '../../utils/format';

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [f, setF] = useState({ role: '', status: '', q: '', page: 1 });
  const [target, setTarget] = useState(null);
  const dlg = useDisclosure();
  const q = useDebounce(f.q, 350);
  const { data, meta, loading, error, reload, setData } = useAsync(
    () => AdminAPI.users({ page: f.page, role: f.role || undefined, status: f.status || undefined, q: q || undefined }),
    [f.page, f.role, f.status, q],
  );
  const [toggle, toggling] = useApiAction(async () => {
    const { data: u } = await AdminAPI.updateUser(target._id, { isActive: !target.isActive });
    setData((list) => list.map((x) => (x._id === u._id ? u : x)));
    dlg.onClose();
    return u;
  }, { success: (u) => `${u.name} ${u.isActive ? 'reactivated' : 'suspended'}`, errorTitle: 'Could not update user' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value, page: 1 });

  return (
    <Box>
      <PageHeader title="Users" subtitle="Riders, drivers and admins. Suspend accounts that violate policies." />
      <Card mb={4}><CardBody>
        <Stack direction={{ base: 'column', md: 'row' }} spacing={3}>
          <InputGroup flex="2"><InputLeftElement pointerEvents="none"><Icon as={FiSearch} color="text.muted" /></InputLeftElement><Input placeholder="Search name, email or phone" value={f.q} onChange={set('q')} aria-label="Search users" /></InputGroup>
          <Select flex="1" value={f.role} onChange={set('role')} aria-label="Role"><option value="">All roles</option><option value="rider">Riders</option><option value="driver">Drivers</option><option value="admin">Admins</option></Select>
          <Select flex="1" value={f.status} onChange={set('status')} aria-label="Account status"><option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option></Select>
        </Stack>
      </CardBody></Card>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <LoadingState />}
      {data?.length === 0 && <EmptyState icon={FiUsers} title="No users found" />}
      {data?.length > 0 && (
        <Card><TableContainer>
          <Table>
            <Thead><Tr><Th>User</Th><Th>Phone</Th><Th>Role</Th><Th>Details</Th><Th>Joined</Th><Th>Status</Th><Th /></Tr></Thead>
            <Tbody>
              {data.map((u) => (
                <Tr key={u._id}>
                  <Td><HStack><Avatar size="sm" name={u.name} src={assetUrl(u.avatarUrl)} /><Box><Text fontWeight={600}>{u.name}</Text><Text fontSize="xs" color="text.muted">{u.email}</Text></Box></HStack></Td>
                  <Td>{u.phone || '—'}</Td>
                  <Td><Badge colorScheme={u.role === 'admin' ? 'purple' : u.role === 'driver' ? 'accent' : 'brand'}>{u.role}</Badge></Td>
                  <Td fontSize="xs">
                    {u.role === 'driver' ? (
                      <>
                        <Text as={RouterLink} to={`/drivers/${u._id}`} fontWeight={600}>{RIDE_TYPE_LABEL[u.driver?.vehicle?.type]} · {u.driver?.vehicle?.plate}</Text>
                        <Text color="text.muted">{u.driver?.rating ? `${u.driver.rating.toFixed(1)}★` : 'No ratings'} · {u.driver?.isOnline ? 'Online' : 'Offline'}</Text>
                      </>
                    ) : u.role === 'rider' ? <Text>Wallet {money(u.walletBalance)}</Text> : '—'}
                  </Td>
                  <Td>{dateOnly(u.createdAt)}</Td>
                  <Td><Badge colorScheme={u.isActive ? 'green' : 'red'}>{u.isActive ? 'Active' : 'Suspended'}</Badge></Td>
                  <Td>
                    {u._id !== me._id && (
                      <Button size="xs" variant="outline" colorScheme={u.isActive ? 'red' : 'green'} onClick={() => { setTarget(u); dlg.onOpen(); }}>
                        {u.isActive ? 'Suspend' : 'Reactivate'}
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer></Card>
      )}
      <Pagination meta={meta} onChange={(page) => setF({ ...f, page })} />
      <ConfirmDialog isOpen={dlg.isOpen} onClose={dlg.onClose} onConfirm={toggle} isLoading={toggling}
        title={target?.isActive ? `Suspend ${target?.name}?` : `Reactivate ${target?.name}?`}
        confirmLabel={target?.isActive ? 'Suspend' : 'Reactivate'} colorScheme={target?.isActive ? 'red' : 'green'}>
        {target?.isActive ? 'They will be signed out and unable to log in or take rides until reactivated.' : 'They will be able to log in and use CabConnect again.'}
      </ConfirmDialog>
    </Box>
  );
}
