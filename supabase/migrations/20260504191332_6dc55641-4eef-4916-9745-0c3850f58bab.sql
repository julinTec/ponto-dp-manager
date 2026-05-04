
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.timesheet_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.timesheet_pages;
ALTER TABLE public.time_entries REPLICA IDENTITY FULL;
ALTER TABLE public.timesheet_batches REPLICA IDENTITY FULL;
ALTER TABLE public.timesheet_pages REPLICA IDENTITY FULL;
