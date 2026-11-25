import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';

export function useMessages({ onlyApproved = true }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      let query = supabase.from('messages').select('*').order('created_at', { ascending: false });

      if (onlyApproved) {
        query = query.eq('approved', true);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setMessages(data || []);
    } catch (error) {
      console.error('Could not load public memories.', error);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [onlyApproved]);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages]);

  return { messages, loading, error, refetch: fetchMessages };
}