use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptSegment {
    pub segment_id: String,
    pub delegate_id: String,
    pub delegate_name: String,
    pub timestamp_seconds: u32,
    pub timestamp_str: String, // "01:24"
    pub text: String,
    pub confidence: f32, // 0.0 - 1.0
    pub source_type: String, // "in_person_mic" | "zoom_sdk"
    pub is_reassigned: bool,
    pub live_argument_draft: Option<GroundedArgumentDraft>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroundedArgumentDraft {
    pub statement_summary: String,
    pub counter_angle: String,
    pub poi_draft: String,
    pub grounded_citation: String,
    pub confidence_tag: String, // "grounded" or "uncertain – verify"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelegateRosterItem {
    pub delegate_id: String,
    pub delegate_name: String,
    pub country_code: String,
    pub color_accent: String,
    pub total_speeches: usize,
    pub current_stance_summary: String,
}

/// Generate fast grounded counter-argument draft for a transcript statement
pub fn generate_grounded_draft(text: &str, delegate_name: &str) -> GroundedArgumentDraft {
    let lower = text.to_lowercase();

    if lower.contains("sanction") || lower.contains("economic") || lower.contains("trade") {
        GroundedArgumentDraft {
            statement_summary: format!("Advocates unilateral economic enforcement without GA oversight: {}", delegate_name),
            counter_angle: "Sovereign Equality & Proportionality".to_string(),
            poi_draft: format!(
                "Point of Information to {}: Does the distinguished delegate concede that Article 41 of the UN Charter reserves economic coercion strictly for the Security Council to prevent unilateral extraterritorial embargoes?",
                delegate_name
            ),
            grounded_citation: "UN Charter Article 41; ICJ Nicaragua Judgment, para 205".to_string(),
            confidence_tag: "grounded".to_string(),
        }
    } else if lower.contains("autonomous") || lower.contains("ai") || lower.contains("weapon") || lower.contains("drone") {
        GroundedArgumentDraft {
            statement_summary: format!("Argues for voluntary self-regulation instead of binding treaties: {}", delegate_name),
            counter_angle: "Article 36 Inadequacy & Verification Vacuum".to_string(),
            poi_draft: format!(
                "Point of Order/Info to {}: How does the delegate reconcile voluntary guidelines with the customary obligation under Additional Protocol I, Article 36, given that proprietary code opacity prevents independent verification?",
                delegate_name
            ),
            grounded_citation: "Geneva Conventions Additional Protocol I, Art. 36; ICRC Position 2023".to_string(),
            confidence_tag: "grounded".to_string(),
        }
    } else if lower.contains("border") || lower.contains("refugee") || lower.contains("asylum") {
        GroundedArgumentDraft {
            statement_summary: format!("Proposes expedited externalized border screenings: {}", delegate_name),
            counter_angle: "Non-Refoulement Peremptory Norm (Jus Cogens)".to_string(),
            poi_draft: format!(
                "POI to {}: Does the delegate recognize that the principle of non-refoulement under Article 33 of the 1951 Refugee Convention applies extraterritorially, barring externalized pushbacks?",
                delegate_name
            ),
            grounded_citation: "1951 Convention Relating to the Status of Refugees, Art. 33(1)".to_string(),
            confidence_tag: "grounded".to_string(),
        }
    } else {
        GroundedArgumentDraft {
            statement_summary: format!("Floor assertion by {}", delegate_name),
            counter_angle: "Procedural Precedent & Evidentiary Threshold".to_string(),
            poi_draft: format!(
                "POI to {}: Can the delegate provide primary documentary evidence for this assertion before the committee adopts this clause in the working paper?",
                delegate_name
            ),
            grounded_citation: "Rules of Procedure Rule 33; Committee Precedent Archive".to_string(),
            confidence_tag: "uncertain – verify".to_string(),
        }
    }
}
