import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env["VITE_SUPABASE_URL"] || "https://fuomybtmkcxhpwebsjkd.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env["VITE_SUPABASE_ANON_KEY"] ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1b215YnRta2N4aHB3ZWJzamtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMjY4MjIsImV4cCI6MjEwMzYwMjgyMn0.ZOjTKAHLD_M-7u8Vring1n-zCYUFp7pIxJF_NlYmMVU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
