-- Create saved_checkins table for storing user's previous check-ins
CREATE TABLE IF NOT EXISTS saved_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    patient_name VARCHAR(255),
    facility_name VARCHAR(255) DEFAULT 'SmartWait Clinic',
    checkin_time TIMESTAMP WITH TIME ZONE NOT NULL,
    last_accessed TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicate entries per device
    UNIQUE(patient_id, device_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_saved_checkins_device_id ON saved_checkins(device_id);
CREATE INDEX IF NOT EXISTS idx_saved_checkins_patient_id ON saved_checkins(patient_id);
CREATE INDEX IF NOT EXISTS idx_saved_checkins_last_accessed ON saved_checkins(last_accessed);
CREATE INDEX IF NOT EXISTS idx_saved_checkins_active ON saved_checkins(is_active) WHERE is_active = true;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_saved_checkins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_saved_checkins_updated_at
    BEFORE UPDATE ON saved_checkins
    FOR EACH ROW
    EXECUTE FUNCTION update_saved_checkins_updated_at();

-- Add comments for documentation
COMMENT ON TABLE saved_checkins IS 'Stores saved check-ins for users to easily access their previous queue entries';
COMMENT ON COLUMN saved_checkins.patient_id IS 'UUID of the patient from queue_entries';
COMMENT ON COLUMN saved_checkins.device_id IS 'Unique identifier for the user device/browser';
COMMENT ON COLUMN saved_checkins.patient_name IS 'Optional patient name for display purposes';
COMMENT ON COLUMN saved_checkins.facility_name IS 'Name of the healthcare facility';
COMMENT ON COLUMN saved_checkins.checkin_time IS 'When the original check-in occurred';
COMMENT ON COLUMN saved_checkins.last_accessed IS 'When this saved check-in was last accessed';
COMMENT ON COLUMN saved_checkins.is_active IS 'Whether this saved check-in is still active/visible';