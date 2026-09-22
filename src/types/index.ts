export interface SourceCitation {
  title: string;
  url: string;
  publication_date?: string;
  domain: string;
  is_verified: boolean;
}

export interface FactualClaim {
  claim_text: string;
  citation: SourceCitation;
  is_uncertain: boolean;
}

export interface ResearchAngle {
  id: string;
  title: string;
  stance: 'Pro' | 'Con' | 'Third-Way';
  is_niche: boolean;
  summary: string;
  factual_claims: FactualClaim[];
  sources: SourceCitation[];
  confidence_score: number;
  confidence_tag: 'verified' | 'uncertain';
}

export interface ApprovedResearchAngle {
  id: string;
  angle_id: string;
  title: string;
  stance: 'Pro' | 'Con' | 'Third-Way';
  is_niche: boolean;
  summary: string;
  approved_at: string;
  factual_claims: FactualClaim[];
  sources: SourceCitation[];
}

export interface ResearchQueryRequest {
  topic: string;
  freeze_date?: string;
  excluded_sources: string[];
  committee_name?: string;
}

export interface ResearchResult {
  topic: string;
  angles: ResearchAngle[];
  total_sources_evaluated: number;
  filtered_out_freeze_date: number;
  filtered_out_excluded_domains: number;
  freeze_date_applied?: string;
  provider_used: string;
}

export interface DocumentSection {
  section_id: string;
  index: number;
  title: string;
  content: string;
  page_number?: number;
  word_count: number;
  keywords: string[];
}

export interface IndexedDocument {
  document_id: string;
  title: string;
  file_type: string;
  total_sections: number;
  total_words: number;
  sections: DocumentSection[];
  uploaded_at: string;
  source_kind: 'uploaded_file' | 'approved_research_dossier';
}

export interface SearchMatchResult {
  target_section_id: string;
  section_title: string;
  section_content: string;
  relevance_score: number;
  highlight_terms: string[];
  matched_line: number;
}

export interface GroundedArgumentDraft {
  statement_summary: string;
  counter_angle: string;
  poi_draft: string;
  grounded_citation: string;
  confidence_tag: string;
}

export interface TranscriptSegment {
  segment_id: string;
  delegate_id: string;
  delegate_name: string;
  timestamp_seconds: number;
  timestamp_str: string;
  text: string;
  confidence: number;
  source_type: 'in_person_mic' | 'zoom_sdk';
  is_reassigned: boolean;
  live_argument_draft?: GroundedArgumentDraft;
}

export interface DelegateRosterItem {
  delegate_id: string;
  delegate_name: string;
  country_code: string;
  flag_emoji: string;
  color_accent: string;
  is_speaking: boolean;
  total_speeches: number;
}

export interface SourceLinkedPoint {
  point_id: string;
  summary_text: string;
  transcript_excerpt: string;
  timestamp_str: string;
  timestamp_seconds: number;
  is_uncertain: boolean;
  target_delegate?: string;
}

export interface CrossContradictionAlert {
  alert_id: string;
  delegate_name: string;
  contradiction_description: string;
  statement_a_timestamp: string;
  statement_a_excerpt: string;
  statement_b_timestamp: string;
  statement_b_excerpt: string;
  confidence_tag: string;
}

export interface DelegatePositionDossier {
  delegate_id: string;
  delegate_name: string;
  overall_stance: string;
  key_arguments: SourceLinkedPoint[];
  rebuttals_given: SourceLinkedPoint[];
  internal_contradictions: SourceLinkedPoint[];
  confidence_status: string;
  total_floor_time_seconds: number;
}

export interface CommitteePositionDocument {
  session_title: string;
  last_updated_timestamp: string;
  total_statements_processed: number;
  delegates: DelegatePositionDossier[];
  cross_delegate_contradictions: CrossContradictionAlert[];
}

export interface ZoomConnectionConfig {
  meeting_id: string;
  meeting_password?: string;
  user_consent_confirmed: boolean;
  bot_display_name: string;
  use_wasapi_fallback: boolean;
}

export interface ZoomParticipant {
  participant_id: string;
  display_name: string;
  is_speaking: boolean;
  has_audio_stream: boolean;
}

export interface ZoomBotStatus {
  is_connected: boolean;
  bot_name: string;
  active_mode: string;
  consent_verified: boolean;
  participants_detected: ZoomParticipant[];
  warning_message?: string;
}

export interface ExportPayload {
  markdown_content: string;
  json_content: string;
  session_title: string;
  export_timestamp: string;
}

export interface DebateProject {
  id: string;
  name: string;
  committee: string;
  motion: string;
  freeze_date?: string;
  excluded_sources: string[];
  created_at: string;
  updated_at: string;
  documents: IndexedDocument[];
  active_document_id?: string;
  approved_research: ApprovedResearchAngle[];
  transcript_segments: TranscriptSegment[];
  roster: DelegateRosterItem[];
  position_document?: CommitteePositionDocument;
}
