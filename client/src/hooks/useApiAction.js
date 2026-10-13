import { useCallback, useState } from 'react';
import { useToast } from '@chakra-ui/react';

/**
 * Wraps a mutating API call with loading state and success/error toasts.
 * Returns [run, loading]. `run` resolves to the result, or undefined on failure.
 */
export function useApiAction(fn, { success, errorTitle = 'Something went wrong' } = {}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const run = useCallback(async (...args) => {
    setLoading(true);
    try {
      const res = await fn(...args);
      if (success) toast({ title: typeof success === 'function' ? success(res) : success, status: 'success', position: 'top-right' });
      return res ?? true;
    } catch (e) {
      toast({ title: errorTitle, description: e.message, status: 'error', position: 'top-right', isClosable: true });
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [fn, success, errorTitle, toast]);
  return [run, loading];
}
