import { useRef } from 'react';
import {
  AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay, Button,
} from '@chakra-ui/react';

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, children, confirmLabel = 'Confirm', colorScheme = 'red', isLoading }) {
  const cancelRef = useRef();
  return (
    <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose} isCentered>
      <AlertDialogOverlay>
        <AlertDialogContent mx={4}>
          <AlertDialogHeader fontSize="lg" fontWeight="bold">{title}</AlertDialogHeader>
          <AlertDialogBody>{children}</AlertDialogBody>
          <AlertDialogFooter gap={3}>
            <Button ref={cancelRef} variant="ghost" onClick={onClose}>Go back</Button>
            <Button colorScheme={colorScheme} onClick={onConfirm} isLoading={isLoading}>{confirmLabel}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
}
