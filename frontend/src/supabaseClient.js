import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rgfmrrfautmenqpzzvdj.supabase.co';
const supabaseKey = 'sb_publishable_eHwIzhzABHGGgqWxarHejg_Q2siVXds';

export const supabase = createClient(supabaseUrl, supabaseKey);