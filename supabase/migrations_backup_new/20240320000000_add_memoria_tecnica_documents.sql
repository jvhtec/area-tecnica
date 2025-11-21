
CREATE TABLE memoria_tecnica_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id),
  project_name TEXT NOT NULL,
  cover_page_url TEXT,
  material_list_url TEXT,
  soundvision_report_url TEXT,
  weight_report_url TEXT,
  power_report_url TEXT,
  rigging_plot_url TEXT,
  final_document_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add trigger for updated_at
CREATE TRIGGER update_memoria_tecnica_documents_updated_at
  BEFORE UPDATE ON memoria_tecnica_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
