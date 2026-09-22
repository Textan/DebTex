use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentSection {
    pub section_id: String,
    pub index: usize,
    pub title: String,
    pub content: String,
    pub page_number: Option<usize>,
    pub word_count: usize,
    pub keywords: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexedDocument {
    pub document_id: String,
    pub title: String,
    pub file_type: String, // "txt", "pdf", "docx"
    pub total_sections: usize,
    pub total_words: usize,
    pub sections: Vec<DocumentSection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMatchResult {
    pub target_section_id: String,
    pub section_title: String,
    pub section_content: String,
    pub relevance_score: f32,
    pub highlight_terms: Vec<String>,
    pub matched_line: usize,
}

/// Index raw document text into structured sections
pub fn index_raw_text(doc_id: &str, title: &str, file_type: &str, raw_content: &str) -> IndexedDocument {
    let mut sections = Vec::new();
    let paragraphs: Vec<&str> = raw_content
        .split("\n\n")
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();

    let mut total_words = 0;

    for (idx, para) in paragraphs.iter().enumerate() {
        let words: Vec<&str> = para.split_whitespace().collect();
        total_words += words.len();

        // Infer title from first line or clause
        let first_line = para.lines().next().unwrap_or("Section").trim();
        let section_title = if first_line.len() > 60 {
            format!("{}...", &first_line[..57])
        } else {
            first_line.to_string()
        };

        let keywords = extract_keywords(para);

        sections.push(DocumentSection {
            section_id: format!("{}-sec-{}", doc_id, idx),
            index: idx,
            title: section_title,
            content: para.to_string(),
            page_number: Some((idx / 3) + 1),
            word_count: words.len(),
            keywords,
        });
    }

    IndexedDocument {
        document_id: doc_id.to_string(),
        title: title.to_string(),
        file_type: file_type.to_string(),
        total_sections: sections.len(),
        total_words,
        sections,
    }
}

/// Search indexed document sections via spoken query
pub fn search_voice_query(doc: &IndexedDocument, spoken_query: &str) -> Option<SearchMatchResult> {
    let query_terms: Vec<String> = tokenize(spoken_query);
    if query_terms.is_empty() {
        return None;
    }

    let mut best_match: Option<(f32, &DocumentSection, Vec<String>)> = None;

    for sec in &doc.sections {
        let sec_tokens = tokenize(&sec.content);
        let sec_token_set: HashSet<String> = sec_tokens.into_iter().collect();

        let mut match_count = 0;
        let mut matched_terms = Vec::new();

        for qt in &query_terms {
            if sec_token_set.contains(qt) || sec.content.to_lowercase().contains(qt) {
                match_count += 1;
                matched_terms.push(qt.clone());
            }
        }

        // Add bonus for matching in section title
        let title_lower = sec.title.to_lowercase();
        let mut title_bonus = 0.0;
        for qt in &query_terms {
            if title_lower.contains(qt) {
                title_bonus += 1.5;
            }
        }

        let score = (match_count as f32) + title_bonus;

        if score > 0.0 {
            if let Some((best_score, _, _)) = best_match {
                if score > best_score {
                    best_match = Some((score, sec, matched_terms));
                }
            } else {
                best_match = Some((score, sec, matched_terms));
            }
        }
    }

    best_match.map(|(score, sec, terms)| {
        SearchMatchResult {
            target_section_id: sec.section_id.clone(),
            section_title: sec.title.clone(),
            section_content: sec.content.clone(),
            relevance_score: score,
            highlight_terms: terms,
            matched_line: sec.index + 1,
        }
    })
}

fn tokenize(text: &str) -> Vec<String> {
    let stop_words: HashSet<&str> = [
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", 
        "with", "by", "of", "about", "against", "between", "into", "through",
        "during", "before", "after", "above", "below", "from", "up", "down",
        "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
        "what", "where", "who", "which", "how", "show", "find", "me", "tell", "section"
    ].iter().cloned().collect();

    text.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .filter(|w| w.len() > 2 && !stop_words.contains(w))
        .map(|w| w.to_string())
        .collect()
}

fn extract_keywords(text: &str) -> Vec<String> {
    let tokens = tokenize(text);
    let mut freq_map: HashMap<String, usize> = HashMap::new();
    for t in tokens {
        *freq_map.entry(t).or_insert(0) += 1;
    }
    let mut sorted: Vec<(String, usize)> = freq_map.into_iter().collect();
    sorted.sort_by(|a, b| b.1.cmp(&a.1));
    sorted.into_iter().take(5).map(|(k, _)| k).collect()
}
