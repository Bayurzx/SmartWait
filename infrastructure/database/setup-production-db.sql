-- SmartWait Production Database Setup
-- Run this script to set up the production database with proper security

-- Create production database and user
CREATE DATABASE smartwait_production;
CREATE USER smartwait_user WITH ENCRYPTED PASSWORD 'CHANGE_ME_STRONG_PASSWORD';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE smartwait_production TO smartwait_user;
GRANT USAGE ON SCHEMA public TO smartwait_user;
GRANT CREATE ON SCHEMA public TO smartwait_user;

-- Connect to the production database
\c smartwait_production;

-- Create tables with production optimizations
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE queue_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'completed', 'no_show')),
    check_in_time TIMESTAMP DEFAULT NOW(),
    estimated_wait_minutes INTEGER,
    called_at TIMESTAMP,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(position) WHERE status IN ('waiting', 'called')
);

CREATE TABLE staff_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_accessed TIMESTAMP DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

CREATE TABLE sms_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    sent_at TIMESTAMP DEFAULT NOW(),
    delivered_at TIMESTAMP,
    twilio_sid VARCHAR(100),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0
);

-- Create indexes for performance
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_patients_created_at ON patients(created_at);

CREATE INDEX idx_queue_positions_patient_id ON queue_positions(patient_id);
CREATE INDEX idx_queue_positions_status ON queue_positions(status);
CREATE INDEX idx_queue_positions_position ON queue_positions(position) WHERE status IN ('waiting', 'called');
CREATE INDEX idx_queue_positions_check_in_time ON queue_positions(check_in_time);

CREATE INDEX idx_staff_sessions_token ON staff_sessions(session_token);
CREATE INDEX idx_staff_sessions_expires_at ON staff_sessions(expires_at);
CREATE INDEX idx_staff_sessions_username ON staff_sessions(username);

CREATE INDEX idx_sms_notifications_patient_id ON sms_notifications(patient_id);
CREATE INDEX idx_sms_notifications_status ON sms_notifications(status);
CREATE INDEX idx_sms_notifications_sent_at ON sms_notifications(sent_at);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queue_positions_updated_at BEFORE UPDATE ON queue_positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions to application user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO smartwait_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO smartwait_user;

-- Create read-only user for monitoring/reporting
CREATE USER smartwait_readonly WITH ENCRYPTED PASSWORD 'CHANGE_ME_READONLY_PASSWORD';
GRANT CONNECT ON DATABASE smartwait_production TO smartwait_readonly;
GRANT USAGE ON SCHEMA public TO smartwait_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO smartwait_readonly;

-- Create backup user
CREATE USER smartwait_backup WITH ENCRYPTED PASSWORD 'CHANGE_ME_BACKUP_PASSWORD';
GRANT CONNECT ON DATABASE smartwait_production TO smartwait_backup;
GRANT USAGE ON SCHEMA public TO smartwait_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO smartwait_backup;

-- Enable row level security (optional, for future use)
-- ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE queue_positions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sms_notifications ENABLE ROW LEVEL SECURITY;

-- Create views for common queries
CREATE VIEW active_queue AS
SELECT 
    qp.id,
    qp.patient_id,
    p.name,
    p.phone,
    qp.position,
    qp.status,
    qp.check_in_time,
    qp.estimated_wait_minutes,
    qp.called_at,
    EXTRACT(EPOCH FROM (NOW() - qp.check_in_time))/60 AS actual_wait_minutes
FROM queue_positions qp
JOIN patients p ON qp.patient_id = p.id
WHERE qp.status IN ('waiting', 'called')
ORDER BY qp.position;

CREATE VIEW queue_statistics AS
SELECT 
    COUNT(*) FILTER (WHERE status = 'waiting') AS waiting_count,
    COUNT(*) FILTER (WHERE status = 'called') AS called_count,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_today,
    AVG(EXTRACT(EPOCH FROM (completed_at - check_in_time))/60) FILTER (WHERE status = 'completed' AND DATE(completed_at) = CURRENT_DATE) AS avg_wait_time_today,
    MAX(position) AS max_position
FROM queue_positions
WHERE DATE(check_in_time) = CURRENT_DATE;

-- Grant view permissions
GRANT SELECT ON active_queue TO smartwait_user;
GRANT SELECT ON queue_statistics TO smartwait_user;
GRANT SELECT ON active_queue TO smartwait_readonly;
GRANT SELECT ON queue_statistics TO smartwait_readonly;

-- Create function for queue cleanup (remove old completed entries)
CREATE OR REPLACE FUNCTION cleanup_old_queue_entries()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM queue_positions 
    WHERE status = 'completed' 
    AND completed_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function for session cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM staff_sessions 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION cleanup_old_queue_entries() TO smartwait_user;
GRANT EXECUTE ON FUNCTION cleanup_expired_sessions() TO smartwait_user;

-- Insert default staff user (change password immediately after deployment)
INSERT INTO staff_sessions (username, session_token, expires_at) VALUES 
('admin', 'CHANGE_ME_INITIAL_TOKEN', NOW() + INTERVAL '1 hour');

COMMIT;