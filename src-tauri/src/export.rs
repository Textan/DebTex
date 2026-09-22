use serde::{Deserialize, Serialize};
use crate::live_listen::TranscriptSegment;
use crate::position_document::CommitteePositionDocument;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportPayload {
    pub markdown_content: String,
    pub json_content: String,
    pub session_title: String,
    pub export_timestamp: String,
}

pub fn generate_unified_export(
    session_title: &str,
    segments: &[TranscriptSegment],
    pos_doc: &CommitteePositionDocument,
) -> ExportPayload {
    let mut md = String::new();
    md.push_str(&format!("# Debate Prep Suite — Session Brief: {}\n\n", session_title));
    md.push_str(&format!("*Exported at {}*\n\n", chrono::Local::now().to_rfc3339()));

    md.push_str("## 1. Committee Position Document\n\n");
    for del in &pos_doc.delegates {
        md.push_str(&format!("### {}\n", del.delegate_name));
        md.push_str(&format!("- **Overall Stance**: {}\n", del.overall_stance));
        md.push_str(&format!("- **Confidence Status**: {}\n", del.confidence_status));
        md.push_str("- **Key Arguments**:\n");
        for arg in &del.key_arguments {
            let uncertain_badge = if arg.is_uncertain { " `[uncertain – verify]`" } else { "" };
            md.push_str(&format!("  - [{}] {}{}\n    > \"{}\"\n", arg.timestamp_str, arg.summary_text, uncertain_badge, arg.transcript_excerpt));
        }
        if !del.rebuttals_given.is_empty() {
            md.push_str("- **Rebuttals Given**:\n");
            for reb in &del.rebuttals_given {
                md.push_str(&format!("  - [{}] {}\n", reb.timestamp_str, reb.summary_text));
            }
        }
        if !del.internal_contradictions.is_empty() {
            md.push_str("- **⚠️ Contradictions Flagged**:\n");
            for con in &del.internal_contradictions {
                md.push_str(&format!("  - **{}**: {}\n", con.timestamp_str, con.summary_text));
            }
        }
        md.push_str("\n");
    }

    if !pos_doc.cross_delegate_contradictions.is_empty() {
        md.push_str("## 2. Cross-Floor Contradiction Matrix\n\n");
        for cc in &pos_doc.cross_delegate_contradictions {
            md.push_str(&format!("- **{}**: {}\n", cc.delegate_name, cc.contradiction_description));
            md.push_str(&format!("  - Initial ([{}]): \"{}\"\n", cc.statement_a_timestamp, cc.statement_a_excerpt));
            md.push_str(&format!("  - Shift ([{}]): \"{}\"\n", cc.statement_b_timestamp, cc.statement_b_excerpt));
        }
        md.push_str("\n");
    }

    md.push_str("## 3. Floor Transcript Excerpts\n\n");
    for seg in segments {
        let reassigned_badge = if seg.is_reassigned { " *(reassigned)*" } else { "" };
        md.push_str(&format!("- `[{}]` **{}**{}: {}\n", seg.timestamp_str, seg.delegate_name, reassigned_badge, seg.text));
    }

    let json_content = serde_json::to_string_pretty(pos_doc).unwrap_or_default();

    ExportPayload {
        markdown_content: md,
        json_content,
        session_title: session_title.to_string(),
        export_timestamp: chrono::Local::now().to_rfc3339(),
    }
}
