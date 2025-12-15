-- Create enum types for bug reports and feature requests
CREATE TYPE bug_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE bug_status AS ENUM ('open', 'in_progress', 'resolved');
CREATE TYPE feature_status AS ENUM ('pending', 'under_review', 'accepted', 'rejected', 'completed');

-- Create bug_reports table
CREATE TABLE bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    reproduction_steps TEXT,
    severity bug_severity NOT NULL DEFAULT 'medium',
    screenshot_url TEXT,
    console_logs JSONB,
    reporter_email TEXT NOT NULL,
    app_version TEXT,
    environment_info JSONB,
    github_issue_url TEXT,
    github_issue_number INTEGER,
    status bug_status NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    admin_notes TEXT
);

-- Create feature_requests table
CREATE TABLE feature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    use_case TEXT,
    reporter_email TEXT NOT NULL,
    status feature_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    completed_at TIMESTAMPTZ,
    admin_notes TEXT
);

-- Create indexes for better query performance
CREATE INDEX idx_bug_reports_status ON bug_reports(status);
CREATE INDEX idx_bug_reports_severity ON bug_reports(severity);
CREATE INDEX idx_bug_reports_created_at ON bug_reports(created_at DESC);
CREATE INDEX idx_bug_reports_created_by ON bug_reports(created_by);
CREATE INDEX idx_feature_requests_status ON feature_requests(status);
CREATE INDEX idx_feature_requests_created_at ON feature_requests(created_at DESC);
CREATE INDEX idx_feature_requests_created_by ON feature_requests(created_by);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to update updated_at automatically
CREATE TRIGGER update_bug_reports_updated_at
    BEFORE UPDATE ON bug_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feature_requests_updated_at
    BEFORE UPDATE ON feature_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bug_reports
-- Anyone can insert (for anonymous bug reporting)
CREATE POLICY "Anyone can submit bug reports"
    ON bug_reports FOR INSERT
    WITH CHECK (true);

-- Users can view their own reports
CREATE POLICY "Users can view their own bug reports"
    ON bug_reports FOR SELECT
    USING (
        auth.uid() = created_by
        OR reporter_email = auth.jwt()->>'email'
    );

-- Admins and management can view all reports
CREATE POLICY "Admins can view all bug reports"
    ON bug_reports FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'management')
        )
    );

-- Admins and management can update reports
CREATE POLICY "Admins can update bug reports"
    ON bug_reports FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'management')
        )
    );

-- Admins and management can delete reports
CREATE POLICY "Admins can delete bug reports"
    ON bug_reports FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'management')
        )
    );

-- RLS Policies for feature_requests
-- Anyone can insert (for anonymous feature requests)
CREATE POLICY "Anyone can submit feature requests"
    ON feature_requests FOR INSERT
    WITH CHECK (true);

-- Users can view their own requests
CREATE POLICY "Users can view their own feature requests"
    ON feature_requests FOR SELECT
    USING (
        auth.uid() = created_by
        OR reporter_email = auth.jwt()->>'email'
    );

-- Admins and management can view all requests
CREATE POLICY "Admins can view all feature requests"
    ON feature_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'management')
        )
    );

-- Admins and management can update requests
CREATE POLICY "Admins can update feature requests"
    ON feature_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'management')
        )
    );

-- Admins and management can delete requests
CREATE POLICY "Admins can delete feature requests"
    ON feature_requests FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'management')
        )
    );

-- Grant necessary permissions
GRANT ALL ON bug_reports TO authenticated;
GRANT ALL ON bug_reports TO anon;
GRANT ALL ON feature_requests TO authenticated;
GRANT ALL ON feature_requests TO anon;
