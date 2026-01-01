export interface FestivalJob {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
}

export interface Artist {
  id: string;
  name: string;
  stage: number;
  date: string;
  profile_complete: boolean;
  soundcheck_start?: string;
  soundcheck_end?: string;
  show_start: string;
  show_end: string;
  technical_info: any;
  infrastructure_info: any;
  extras: any;
  notes?: string;
}

export interface Stage {
  id: string;
  name: string;
  number: number;
}

export interface JobDocumentEntry {
  id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  read_only?: boolean;
  template_type?: string | null;
}

export interface ArtistRiderFile {
  id: string;
  file_name: string;
  file_path: string;
  created_at: string;
  artist_id?: string;
  festival_artists?: {
    id: string;
    name: string;
  } | null;
}

