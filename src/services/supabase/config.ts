import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kxaiyspsvtvjxyndqxwk.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4YWl5c3BzdnR2anh5bmRxeHdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MjU4NjMsImV4cCI6MjA5MjQwMTg2M30.OKIsWqsifxi6vpGfVq_YPG3dIUljVFriM5uuleAwR2A'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
