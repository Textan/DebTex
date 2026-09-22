import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  FileText, 
  Search, 
  Upload, 
  Sparkles, 
  CheckCircle2, 
  ArrowDown, 
  BookOpen, 
  Volume2, 
  Plus, 
  Trash2,
  Layers
} from 'lucide-react';
import { DebateProject, IndexedDocument, SearchMatchResult } from '../types';
import { parseAndIndexDocument, findVoiceMatch } from '../services/api';
import { saveProject } from '../services/cloudVault';

interface VoiceDocumentSearchProps {
  project: DebateProject;
  onUpdateProject: (p: DebateProject) => void;
}

export const VoiceDocumentSearch: React.FC<VoiceDocumentSearchProps> = ({
  project,
  onUpdateProject
}) => {
  const activeDoc = project.documents.find(
    d => d.document_id === project.active_document_id
  ) || project.documents[0] || null;

  const [isListening, setIsListening] = useState(false);
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const [activeMatch, setActiveMatch] = useState<SearchMatchResult | null>(null);
  const [manualQuery, setManualQuery] = useState('');
  const [recognitionError, setRecognitionError] = useState<string | null>(null);

  // Manual Text Paste Modal / Drawer
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedTitle, setPastedTitle] = useState('');
  const [pastedContent, setPastedContent] = useState('');

  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll when match changes
  const executeQuery = async (queryText: string) => {
    if (!activeDoc || !queryText.trim()) return;

    const match = await findVoiceMatch(activeDoc, queryText);
    if (match) {
      setActiveMatch(match);
      const targetElement = sectionRefs.current[match.target_section_id];
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      setActiveMatch(null);
    }
  };

  // Handle Real File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'txt';
      const docId = `doc-${Date.now()}`;
      const title = file.name.replace(/\.[^/.]+$/, "");

      const indexed = await parseAndIndexDocument(docId, title, fileExt, content);
      const newDoc: IndexedDocument = {
        ...indexed,
        uploaded_at: new Date().toISOString(),
        source_kind: 'uploaded_file'
      };

      const updatedDocs = [...project.documents, newDoc];
      const updatedProject: DebateProject = {
        ...project,
        documents: updatedDocs,
        active_document_id: newDoc.document_id
      };

      saveProject(updatedProject);
      onUpdateProject(updatedProject);
      setActiveMatch(null);
    };

    reader.readAsText(file);
  };

  // Handle Pasted Text Creation
  const handleCreatePastedDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedTitle.trim() || !pastedContent.trim()) return;

    const docId = `doc-${Date.now()}`;
    const indexed = await parseAndIndexDocument(docId, pastedTitle.trim(), 'txt', pastedContent.trim());
    const newDoc: IndexedDocument = {
      ...indexed,
      uploaded_at: new Date().toISOString(),
      source_kind: 'uploaded_file'
    };

    const updatedDocs = [...project.documents, newDoc];
    const updatedProject: DebateProject = {
      ...project,
      documents: updatedDocs,
      active_document_id: newDoc.document_id
    };

    saveProject(updatedProject);
    onUpdateProject(updatedProject);
    setShowPasteModal(false);
    setPastedTitle('');
    setPastedContent('');
    setActiveMatch(null);
  };

  // Switch Active Document
  const handleSelectDoc = (docId: string) => {
    const updatedProject: DebateProject = {
      ...project,
      active_document_id: docId
    };
    saveProject(updatedProject);
    onUpdateProject(updatedProject);
    setActiveMatch(null);
  };

  // Delete Document
  const handleDeleteDoc = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Remove this document from project?')) {
      const updatedDocs = project.documents.filter(d => d.document_id !== docId);
      const updatedProject: DebateProject = {
        ...project,
        documents: updatedDocs,
        active_document_id: updatedDocs[0]?.document_id
      };
      saveProject(updatedProject);
      onUpdateProject(updatedProject);
      setActiveMatch(null);
    }
  };

  // Web Speech API Integration
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    setRecognitionError(null);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setRecognitionError('Web Speech API is not available in this browser window. Type queries or use quick spoken prompts.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setSpokenTranscript('Listening to floor audio...');
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setSpokenTranscript(transcript);
        setManualQuery(transcript);
      };

      recognition.onerror = (event: any) => {
        setRecognitionError(`Speech recognition status: ${event.error}`);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (spokenTranscript) {
          executeQuery(spokenTranscript);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setRecognitionError(`Failed to initialize Web Speech API: ${err.message}`);
      setIsListening(false);
    }
  };

  return (
    <div className="voice-doc-search-view">
      {/* Header */}
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <Volume2 size={22} color="#0078D4" />
            Voice Document Search — {project.name}
          </h1>
          <p className="view-subtitle">
            Upload any resolution or working paper. Approved research from Part 1 automatically compiles here and can be searched and highlighted via voice.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="badge badge-verified">
            <CheckCircle2 size={12} /> Web Speech API STT Active
          </span>
          <span className="badge" style={{ background: 'rgba(0, 120, 212, 0.15)', color: '#60CDFF' }}>
            <FileText size={12} /> {project.documents.length} Documents in Vault
          </span>
        </div>
      </div>

      {/* Control Bar: Document Tabs & Upload */}
      <div className="fluent-card" style={{ background: '#1c1c1c' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Top Row: Document Selector / Upload Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Working Documents:</span>
              {project.documents.length === 0 ? (
                <span style={{ fontSize: '11px', color: '#888', fontStyle: 'italic' }}>
                  No documents yet. Upload a file or approve research from Part 1.
                </span>
              ) : (
                project.documents.map(doc => {
                  const isActive = activeDoc?.document_id === doc.document_id;
                  const isResearch = doc.source_kind === 'approved_research_dossier';

                  return (
                    <div
                      key={doc.document_id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: isActive ? 'rgba(0, 120, 212, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                        border: isActive ? '1px solid var(--fluent-accent)' : '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '3px 8px',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleSelectDoc(doc.document_id)}
                    >
                      {isResearch ? (
                        <Sparkles size={12} color="#FFB900" style={{ marginRight: '4px' }} />
                      ) : (
                        <FileText size={12} color="#60CDFF" style={{ marginRight: '4px' }} />
                      )}
                      <span style={{ fontSize: '11px', fontWeight: isActive ? 600 : 400, color: '#fff' }}>
                        {doc.title.length > 25 ? `${doc.title.substring(0, 23)}...` : doc.title}
                      </span>
                      <button
                        style={{ background: 'none', border: 'none', color: '#888', marginLeft: '6px', cursor: 'pointer' }}
                        title="Delete document"
                        onClick={e => handleDeleteDoc(doc.document_id, e)}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Upload Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".txt,.md,.pdf,.docx,.doc"
                onChange={handleFileUpload}
              />
              <button 
                id="upload-doc-file-btn"
                className="fluent-btn secondary" 
                style={{ fontSize: '11px' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={13} /> Upload File (TXT/MD/PDF)
              </button>
              <button 
                id="paste-text-doc-btn"
                className="fluent-btn secondary" 
                style={{ fontSize: '11px' }}
                onClick={() => setShowPasteModal(true)}
              >
                <Plus size={13} /> Paste Resolution Text
              </button>
            </div>
          </div>

          {/* Voice Search & Query Row */}
          {activeDoc && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '6px' }}>
              <button
                id="voice-mic-btn"
                className={`fluent-btn ${isListening ? 'danger' : ''}`}
                style={{ minWidth: '130px', height: '38px', gap: '8px' }}
                onClick={toggleListening}
              >
                {isListening ? (
                  <>
                    <MicOff size={16} /> Stop Listening
                  </>
                ) : (
                  <>
                    <Mic size={16} /> Speak Topic
                  </>
                )}
              </button>

              {isListening && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px' }}>
                  <div className="waveform-bar" />
                  <div className="waveform-bar" />
                  <div className="waveform-bar" />
                  <div className="waveform-bar" />
                  <div className="waveform-bar" />
                </div>
              )}

              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: '#8E8E93' }} />
                <input
                  id="doc-search-input"
                  type="text"
                  className="fluent-input"
                  style={{ width: '100%', paddingLeft: '34px', height: '38px' }}
                  placeholder={isListening ? 'Listening to speech...' : `Search within "${activeDoc.title}"...`}
                  value={manualQuery}
                  onChange={e => {
                    setManualQuery(e.target.value);
                    executeQuery(e.target.value);
                  }}
                  onKeyDown={e => e.key === 'Enter' && executeQuery(manualQuery)}
                />
              </div>

              <button 
                id="doc-search-btn"
                className="fluent-btn secondary" 
                style={{ height: '38px' }} 
                onClick={() => executeQuery(manualQuery)}
              >
                Search
              </button>
            </div>
          )}

          {recognitionError && (
            <div style={{ fontSize: '11px', color: '#ff9f0a' }}>
              ℹ️ {recognitionError}
            </div>
          )}
        </div>
      </div>

      {/* Active Match Feedback Banner */}
      {activeMatch && (
        <div style={{ 
          background: 'rgba(255, 185, 0, 0.12)', 
          border: '1px solid rgba(255, 185, 0, 0.35)', 
          padding: '10px 14px', 
          borderRadius: 'var(--radius-md)', 
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="#FFB900" />
            <span style={{ fontSize: '12px', color: '#fff' }}>
              Auto-scrolled & highlighted match: <strong>{activeMatch.section_title}</strong> (Score: {activeMatch.relevance_score.toFixed(1)})
            </span>
          </div>
          <button
            className="fluent-btn secondary"
            style={{ fontSize: '11px', padding: '2px 8px' }}
            onClick={() => {
              const el = sectionRefs.current[activeMatch.target_section_id];
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          >
            <ArrowDown size={12} /> Scroll to Section
          </button>
        </div>
      )}

      {/* Document Viewer Pane or Clean Blank Dropzone */}
      <div 
        id="document-viewer-container"
        className="fluent-card" 
        style={{ 
          maxHeight: '520px', 
          overflowY: 'auto', 
          padding: activeDoc ? '24px 28px' : '60px 20px',
          background: '#151515',
          fontFamily: "'Segoe UI', -apple-system, sans-serif"
        }}
      >
        {activeDoc ? (
          <div>
            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60CDFF', fontSize: '11px', fontWeight: 600 }}>
                <BookOpen size={14} /> {activeDoc.file_type.toUpperCase()} • {activeDoc.total_sections} SECTIONS • {activeDoc.total_words} WORDS
                {activeDoc.source_kind === 'approved_research_dossier' && (
                  <span className="badge badge-niche" style={{ marginLeft: '6px' }}>
                    <Sparkles size={10} /> Auto-Compiled from Approved Research (Part 1)
                  </span>
                )}
              </div>
              <h2 style={{ fontSize: '17px', color: '#fff', marginTop: '4px', fontWeight: 600 }}>
                {activeDoc.title}
              </h2>
            </div>

            {/* Rendered Document Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {activeDoc.sections.map(section => {
                const isMatch = activeMatch?.target_section_id === section.section_id;

                return (
                  <div
                    key={section.section_id}
                    id={section.section_id}
                    ref={el => sectionRefs.current[section.section_id] = el}
                    className={`doc-section ${isMatch ? 'section-highlighted' : ''}`}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-sm)',
                      background: isMatch ? 'rgba(0, 120, 212, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      border: isMatch ? '1px solid var(--fluent-accent)' : '1px solid transparent',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: isMatch ? '#FFB900' : 'var(--text-muted)' }}>
                        SECTION {section.index + 1}: {section.title}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {section.word_count} words
                      </span>
                    </div>

                    <p style={{ 
                      fontSize: '13px', 
                      lineHeight: '1.7', 
                      color: isMatch ? '#FFFFFF' : '#D0D0D0',
                      whiteSpace: 'pre-line'
                    }}>
                      {section.content}
                    </p>

                    {/* Keywords */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                      {section.keywords.map(kw => (
                        <span 
                          key={kw} 
                          style={{ 
                            fontSize: '10px', 
                            color: 'var(--text-muted)', 
                            background: 'rgba(255, 255, 255, 0.04)', 
                            padding: '1px 6px', 
                            borderRadius: '3px' 
                          }}
                        >
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Blank Slate Upload Dropzone */
          <div style={{ textAlign: 'center', maxWidth: '460px', margin: '0 auto' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(0, 120, 212, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Upload size={26} color="#0078D4" />
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
              No Documents in this Debate
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5' }}>
              Upload any debate resolution, draft working paper, or briefing document. Or approve research angles from <strong>Part 1: Deep Research Engine</strong> to automatically build your grounded research dossier.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                className="fluent-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} /> Upload Custom Document
              </button>
              <button
                className="fluent-btn secondary"
                onClick={() => setShowPasteModal(true)}
              >
                <Plus size={14} /> Paste Text
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Paste Resolution Text Modal */}
      {showPasteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200
        }}>
          <div className="fluent-card" style={{ width: '560px', background: '#202020', border: '1px solid var(--fluent-accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600 }}>Paste Document or Resolution Text</h2>
              <button className="fluent-btn secondary" style={{ padding: '2px 8px' }} onClick={() => setShowPasteModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreatePastedDoc} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Document Title</label>
                <input
                  type="text"
                  required
                  className="fluent-input"
                  style={{ width: '100%', marginTop: '4px' }}
                  placeholder="e.g. Draft Resolution 1.1 or Committee Working Paper"
                  value={pastedTitle}
                  onChange={e => setPastedTitle(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Content / Clauses (paragraphs separated by blank lines)</label>
                <textarea
                  required
                  className="fluent-input"
                  style={{ width: '100%', minHeight: '180px', marginTop: '4px', resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="Paste clauses or document paragraphs here..."
                  value={pastedContent}
                  onChange={e => setPastedContent(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="fluent-btn secondary" onClick={() => setShowPasteModal(false)}>Cancel</button>
                <button type="submit" className="fluent-btn">Index & Load Document</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
