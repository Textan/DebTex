// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod credentials;
mod search_provider;
mod document_indexer;
mod live_listen;
mod zoom_bot;
mod position_document;
mod export;

use tauri::command;
use search_provider::{ResearchQueryRequest, ResearchResult, execute_deep_research};
use document_indexer::{IndexedDocument, SearchMatchResult, index_raw_text, search_voice_query};
use live_listen::TranscriptSegment;
use zoom_bot::{ZoomConnectionConfig, ZoomBotStatus, connect_zoom_bot};
use position_document::{CommitteePositionDocument, compile_committee_position_document};
use export::{ExportPayload, generate_unified_export};

#[command]
async fn run_deep_research(request: ResearchQueryRequest) -> Result<ResearchResult, String> {
    execute_deep_research(request).await
}

#[command]
fn parse_and_index_document(doc_id: String, title: String, file_type: String, content: String) -> IndexedDocument {
    index_raw_text(&doc_id, &title, &file_type, &content)
}

#[command]
fn find_voice_match(doc: IndexedDocument, query: String) -> Option<SearchMatchResult> {
    search_voice_query(&doc, &query)
}

#[command]
fn init_zoom_bot(config: ZoomConnectionConfig) -> Result<ZoomBotStatus, String> {
    connect_zoom_bot(config)
}

#[command]
fn build_position_document(session_title: String, segments: Vec<TranscriptSegment>) -> CommitteePositionDocument {
    compile_committee_position_document(&session_title, &segments)
}

#[command]
fn save_credential(key_name: String, secret: String) -> Result<(), String> {
    credentials::store_secret(&key_name, &secret)
}

#[command]
fn read_credential(key_name: String) -> Result<String, String> {
    credentials::get_secret(&key_name)
}

#[command]
fn export_debate_brief(
    session_title: String,
    segments: Vec<TranscriptSegment>,
    position_doc: CommitteePositionDocument,
) -> ExportPayload {
    generate_unified_export(&session_title, &segments, &position_doc)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            run_deep_research,
            parse_and_index_document,
            find_voice_match,
            init_zoom_bot,
            build_position_document,
            save_credential,
            read_credential,
            export_debate_brief
        ])
        .run(tauri::generate_context!())
        .expect("error while running debate prep suite application");
}
