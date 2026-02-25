-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'booking', 'guide_assignment', 'status_change', 'review', 'admin_action'
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(500), -- Optional link to related resource
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Add comment
COMMENT ON TABLE notifications IS 'Stores user notifications for bookings, assignments, and other events';
