-- Adicionar dispatch_job_id em sent_emails para vincular ao job de disparo
ALTER TABLE sent_emails 
ADD COLUMN dispatch_job_id UUID REFERENCES dispatch_jobs(id);

-- Adicionar sent_email_id em email_tracking_events para suportar tracking de emails do disparo
ALTER TABLE email_tracking_events
ADD COLUMN sent_email_id UUID REFERENCES sent_emails(id);

-- Index para performance nas consultas
CREATE INDEX idx_sent_emails_dispatch_job_id ON sent_emails(dispatch_job_id);
CREATE INDEX idx_email_tracking_sent_email_id ON email_tracking_events(sent_email_id);