-- Create vacation_requests table
CREATE TABLE vacation_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  technician_id UUID REFERENCES technicians(id) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_vacation_requests_technician_id ON vacation_requests(technician_id);
CREATE INDEX idx_vacation_requests_status ON vacation_requests(status);
