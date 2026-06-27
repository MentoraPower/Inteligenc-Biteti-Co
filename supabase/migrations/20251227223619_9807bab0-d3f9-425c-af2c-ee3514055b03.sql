-- Create dispatch_jobs table for tracking message dispatches
CREATE TABLE public.dispatch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('email', 'whatsapp_web', 'whatsapp_business')),
  sub_origin_id UUID NOT NULL REFERENCES crm_sub_origins(id) ON DELETE CASCADE,
  origin_name TEXT,
  sub_origin_name TEXT,
  total_leads INT NOT NULL DEFAULT 0,
  valid_leads INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  interval_seconds INT NOT NULL DEFAULT 5,
  message_template TEXT,
  current_lead_name TEXT,
  error_log JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dispatch_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view dispatch_jobs"
ON public.dispatch_jobs FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert dispatch_jobs"
ON public.dispatch_jobs FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update dispatch_jobs"
ON public.dispatch_jobs FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete dispatch_jobs"
ON public.dispatch_jobs FOR DELETE USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_dispatch_jobs_updated_at
BEFORE UPDATE ON public.dispatch_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_jobs;