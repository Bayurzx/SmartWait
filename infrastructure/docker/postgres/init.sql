-- SmartWait Database Initialization Script
-- This script sets up the basic database structure for development

-- Create database if it doesn't exist (handled by Docker environment)
-- CREATE DATABASE IF NOT EXISTS smartwait;

-- Use the smartwait database
\c smartwait;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create patients table
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create queue_positions table
CREATE TABLE IF NOT EXISTS queue_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'completed', 'no_show')),
    check_in_time TIMESTAMP DEFAULT NOW(),
    estimated_wait_minutes INTEGER,
    called_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure unique positions for active queue entries
    UNIQUE(position) WHERE status IN ('waiting', 'called')
);

-- Create staff_sessions table for simple authentication
CREATE TABLE IF NOT EXISTS staff_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create sms_notifications table for tracking SMS delivery
CREATE TABLE IF NOT EXISTS sms_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    sent_at TIMESTAMP DEFAULT NOW(),
    twilio_sid VARCHAR(100),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_queue_positions_status ON queue_positions(status);
CREATE INDEX IF NOT EXISTS idx_queue_positions_position ON queue_positions(position);
CREATE INDEX IF NOT EXISTS idx_queue_positions_patient_id ON queue_positions(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_token ON staff_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sms_notifications_patient_id ON sms_notifications(patient_id);

-- Insert default staff user for development
INSERT INTO staff_sessions (username, session_token, expires_at) 
VALUES ('admin', 'dev-session-token-123', NOW() + INTERVAL '24 hours')
ON CONFLICT DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queue_positions_updated_at BEFORE UPDATE ON queue_positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();