use serde::{Deserialize, Serialize};
use crate::live_listen::TranscriptSegment;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitteePositionDocument {
    pub session_title: String,
    pub last_updated_timestamp: String,
    pub total_statements_processed: usize,
    pub delegates: Vec<DelegatePositionDossier>,
    pub cross_delegate_contradictions: Vec<CrossContradictionAlert>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelegatePositionDossier {
    pub delegate_id: String,
    pub delegate_name: String,
    pub overall_stance: String,
    pub key_arguments: Vec<SourceLinkedPoint>,
    pub rebuttals_given: Vec<SourceLinkedPoint>,
    pub internal_contradictions: Vec<SourceLinkedPoint>,
    pub confidence_status: String, // "verified" or "[uncertain – verify]"
    pub total_floor_time_seconds: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceLinkedPoint {
    pub point_id: String,
    pub summary_text: String,
    pub transcript_excerpt: String,
    pub timestamp_str: String,
    pub timestamp_seconds: u32,
    pub is_uncertain: bool,
    pub target_delegate: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossContradictionAlert {
    pub alert_id: String,
    pub delegate_name: String,
    pub contradiction_description: String,
    pub statement_a_timestamp: String,
    pub statement_a_excerpt: String,
    pub statement_b_timestamp: String,
    pub statement_b_excerpt: String,
    pub confidence_tag: String,
}

/// Compile or recompute the Committee Position Document from the current transcript segments
pub fn compile_committee_position_document(
    session_title: &str,
    segments: &[TranscriptSegment],
) -> CommitteePositionDocument {
    let mut dossiers: Vec<DelegatePositionDossier> = Vec::new();
    let mut cross_contradictions: Vec<CrossContradictionAlert> = Vec::new();

    // Group segments by delegate
    let mut delegate_map: std::collections::HashMap<String, Vec<&TranscriptSegment>> = std::collections::HashMap::new();
    for seg in segments {
        delegate_map.entry(seg.delegate_id.clone()).or_default().push(seg);
    }

    for (del_id, del_segs) in delegate_map {
        let delegate_name = del_segs.first().map(|s| s.delegate_name.clone()).unwrap_or_else(|| "Unknown Delegate".to_string());
        let mut key_args = Vec::new();
        let mut rebuttals = Vec::new();
        let mut internal_contradictions = Vec::new();
        let mut total_time = 0;
        let mut low_confidence_count = 0;

        let mut mentions_voluntary = false;
        let mut voluntary_timestamp = String::new();
        let mut voluntary_excerpt = String::new();

        let mut mentions_binding = false;
        let mut binding_timestamp = String::new();
        let mut binding_excerpt = String::new();

        for seg in &del_segs {
            total_time += 45; // Approximate 45s per floor turn
            let is_uncertain = seg.confidence < 0.85;
            if is_uncertain {
                low_confidence_count += 1;
            }

            let text_lower = seg.text.to_lowercase();

            // Detect Stance & Contradictions
            if text_lower.contains("voluntary") || text_lower.contains("guidelines") || text_lower.contains("national sovereignty") {
                mentions_voluntary = true;
                voluntary_timestamp = seg.timestamp_str.clone();
                voluntary_excerpt = seg.text.clone();
            }

            if (text_lower.contains("binding") && !text_lower.contains("non-binding")) || text_lower.contains("mandatory") || text_lower.contains("sanctions") || text_lower.contains("enforce") {
                mentions_binding = true;
                binding_timestamp = seg.timestamp_str.clone();
                binding_excerpt = seg.text.clone();
            }

            // Distinguish rebuttal vs argument
            if text_lower.contains("reject") || text_lower.contains("oppose") || text_lower.contains("rebut") || text_lower.contains("disagree") {
                rebuttals.push(SourceLinkedPoint {
                    point_id: format!("reb-{}", seg.segment_id),
                    summary_text: format!("Rebutted opposition motion: {}", truncate(&seg.text, 80)),
                    transcript_excerpt: seg.text.clone(),
                    timestamp_str: seg.timestamp_str.clone(),
                    timestamp_seconds: seg.timestamp_seconds,
                    is_uncertain,
                    target_delegate: None,
                });
            } else {
                key_args.push(SourceLinkedPoint {
                    point_id: format!("arg-{}", seg.segment_id),
                    summary_text: summarize_claim(&seg.text),
                    transcript_excerpt: seg.text.clone(),
                    timestamp_str: seg.timestamp_str.clone(),
                    timestamp_seconds: seg.timestamp_seconds,
                    is_uncertain,
                    target_delegate: None,
                });
            }
        }

        // Flag Contradiction if delegate advocated voluntary guidelines then demanded mandatory sanctions across distinct turns
        if mentions_voluntary && mentions_binding && voluntary_timestamp != binding_timestamp {
            let alert = CrossContradictionAlert {
                alert_id: format!("contra-{}", del_id),
                delegate_name: delegate_name.clone(),
                contradiction_description: "Direct Shift: Advocated voluntary national self-regulation at early stage, but subsequently demanded mandatory multilateral compliance penalties.".to_string(),
                statement_a_timestamp: voluntary_timestamp.clone(),
                statement_a_excerpt: voluntary_excerpt.clone(),
                statement_b_timestamp: binding_timestamp.clone(),
                statement_b_excerpt: binding_excerpt.clone(),
                confidence_tag: "verified".to_string(),
            };
            cross_contradictions.push(alert);

            internal_contradictions.push(SourceLinkedPoint {
                point_id: format!("contra-point-{}", del_id),
                summary_text: "Internal Inconsistency: Shifted from voluntary guidelines to mandatory enforcement".to_string(),
                transcript_excerpt: format!("Shift between {} ('{}') and {} ('{}')", voluntary_timestamp, truncate(&voluntary_excerpt, 40), binding_timestamp, truncate(&binding_excerpt, 40)),
                timestamp_str: format!("{} / {}", voluntary_timestamp, binding_timestamp),
                timestamp_seconds: 0,
                is_uncertain: false,
                target_delegate: None,
            });
        }

        let overall_stance = if mentions_binding && !mentions_voluntary {
            "Rigid Pro-Enforcement (Demands binding treaty thresholds)".to_string()
        } else if mentions_voluntary && !mentions_binding {
            "Sovereignty & Voluntary Frameworks (Opposes binding extraterritorial mandates)".to_string()
        } else if mentions_voluntary && mentions_binding {
            "Compromised / Wavering (Contradictory stances on binding enforcement)".to_string()
        } else {
            "Moderate Observer / Unaligned floor posture".to_string()
        };

        let confidence_status = if low_confidence_count > 0 {
            "[uncertain – verify]".to_string()
        } else {
            "verified".to_string()
        };

        dossiers.push(DelegatePositionDossier {
            delegate_id: del_id,
            delegate_name,
            overall_stance,
            key_arguments: key_args,
            rebuttals_given: rebuttals,
            internal_contradictions,
            confidence_status,
            total_floor_time_seconds: total_time,
        });
    }

    // Sort dossiers alphabetically by delegate name
    dossiers.sort_by(|a, b| a.delegate_name.cmp(&b.delegate_name));

    CommitteePositionDocument {
        session_title: session_title.to_string(),
        last_updated_timestamp: chrono::Local::now().format("%H:%M:%S").to_string(),
        total_statements_processed: segments.len(),
        delegates: dossiers,
        cross_delegate_contradictions: cross_contradictions,
    }
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() > max {
        format!("{}...", &s[..max - 3])
    } else {
        s.to_string()
    }
}

fn summarize_claim(s: &str) -> String {
    let words: Vec<&str> = s.split_whitespace().collect();
    if words.len() > 14 {
        words[..14].join(" ") + "..."
    } else {
        s.to_string()
    }
}
