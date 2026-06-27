-- Create dashboards table for saved panels
CREATE TABLE public.dashboards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'scratch',
  widgets JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view dashboards"
ON public.dashboards
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create dashboards"
ON public.dashboards
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update dashboards"
ON public.dashboards
FOR UPDATE
USING (true);

CREATE POLICY "Authenticated users can delete dashboards"
ON public.dashboards
FOR DELETE
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_dashboards_updated_at
BEFORE UPDATE ON public.dashboards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();