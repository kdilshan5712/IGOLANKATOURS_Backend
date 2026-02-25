-- Create email_logs table for tracking sent emails
CREATE TABLE IF NOT EXISTS email_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL, -- 'sent', 'failed'
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on recipient and status for faster queries
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);

COMMENT ON TABLE email_logs IS 'Logs of all system emails sent via Nodemailer';
