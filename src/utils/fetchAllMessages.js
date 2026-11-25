import { supabase } from '../lib/supabase.js';

const MESSAGE_PAGE_SIZE = 1000;

export async function fetchAllMessages({ ascending = false } = {}) {
  const messages = [];
  let start = 0;

  while (true) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending })
      .order('id', { ascending })
      .range(start, start + MESSAGE_PAGE_SIZE - 1);
    if (error) throw error;

    const page = data || [];
    messages.push(...page);
    if (page.length < MESSAGE_PAGE_SIZE) return messages;
    start += page.length;
  }
}
