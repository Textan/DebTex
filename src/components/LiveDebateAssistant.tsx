import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Video, 
  Mic, 
  MicOff, 
  Play, 
  Pause, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Zap, 
  ShieldCheck, 
  MessageSquare, 
  FileText, 
  UserCheck, 
  RefreshCw, 
  Edit3,
  Plus,
  Send
} from 'lucide-react';
import { 
  DebateProject,
  TranscriptSegment, 
  DelegateRosterItem, 
  CommitteePositionDocument, 
  ZoomBotStatus, 
  ExportPayload 
} from '../types';
import { 
  buildPositionDocument, 
  generateLiveArgumentDraft, 
  initZoomBot, 
  exportSession 
} from '../services/api';
import { saveProject } from '../services/cloudVault';

interface LiveDebateAssistantProps {
  project: DebateProject;
  onUpdateProject: (p: DebateProject) => void;
}

export const LiveDebateAssistant: React.FC<LiveDebateAssistantProps> = ({
  project,
  onUpdateProject
}) => {
  const [floorMode, setFloorMode] = useState<'in_person' | 'zoom'>('in_person');
  const [isListening, setIsListening] = useState(false);
  const [selectedDelegateId, setSelectedDelegateId] = useState<string>(
    project.roster[0]?.delegate_id || 'del-1'
  );
  const [assistiveSuggestion, setAssistiveSuggestion] = useState<string | null>(null);

  // Quick Speech Input for In-Person or Manual Entry
  const [speechInputText, setSpeechInputText] = useState('');

  // Add Delegate State
  const [showAddDelegate, setShowAddDelegate] = useState(false);
  const [newDelName, setNewDelName] = useState('');
  const [newDelCode, setNewDelCode] = useState('');

  // Zoom Bot State
  const [showZoomConsentModal, setShowZoomConsentModal] = useState(false);
  const [zoomHostConsentConfirmed, setZoomHostConsentConfirmed] = useState(false);
  const [zoomMeetingId, setZoomMeetingId] = useState('849 2011 9382');
  const [useWasapiFallback, setUseWasapiFallback] = useState(false);
  const [zoomBotStatus, setZoomBotStatus] = useState<ZoomBotStatus | null>(null);

  // Position Document & Export
  const [positionDoc, setPositionDoc] = useState<CommitteePositionDocument | null>(
    project.position_document || null
  );
  const [exportModalPayload, setExportModalPayload] = useState<ExportPayload | null>(null);
  const [activeTab, setActiveTab] = useState<'position_doc' | 'live_transcript' | 'argument_drafts'>('position_doc');

  const segments = project.transcript_segments;
  const roster = project.roster;

  // Recompute Position Document whenever transcript segments change
  useEffect(() => {
    if (segments.length === 0) {
      setPositionDoc(null);
      return;
    }

    buildPositionDocument(project.name, segments).then(doc => {
      setPositionDoc(doc);
      const updatedProj: DebateProject = {
        ...project,
        position_document: doc
      };
      saveProject(updatedProj);
    });
  }, [segments.length]);

  // Handle Delegate Reassignment for any past segment
  const handleReassignSegment = async (segmentId: string, newDelegateId: string) => {
    const targetDelegate = roster.find(d => d.delegate_id === newDelegateId);
    if (!targetDelegate) return;

    const updatedSegments = segments.map(seg => {
      if (seg.segment_id === segmentId) {
        return {
          ...seg,
          delegate_id: targetDelegate.delegate_id,
          delegate_name: targetDelegate.delegate_name,
          is_reassigned: true,
          live_argument_draft: generateLiveArgumentDraft(seg.text, targetDelegate.delegate_name)
        };
      }
      return seg;
    });

    const newPosDoc = await buildPositionDocument(project.name, updatedSegments);
    setPositionDoc(newPosDoc);

    const updatedProj: DebateProject = {
      ...project,
      transcript_segments: updatedSegments,
      position_document: newPosDoc
    };

    saveProject(updatedProj);
    onUpdateProject(updatedProj);
  };

  // Add a speech statement from active delegate
  const handleAddSpeech = (text: string) => {
    if (!text.trim()) return;

    const activeDel = roster.find(d => d.delegate_id === selectedDelegateId) || roster[0];
    const newTimestampSec = (segments.length + 1) * 35;
    const mins = Math.floor(newTimestampSec / 60).toString().padStart(2, '0');
    const secs = (newTimestampSec % 60).toString().padStart(2, '0');

    const newSeg: TranscriptSegment = {
      segment_id: `seg-${Date.now()}`,
      delegate_id: activeDel.delegate_id,
      delegate_name: activeDel.delegate_name,
      timestamp_seconds: newTimestampSec,
      timestamp_str: `${mins}:${secs}`,
      text: text.trim(),
      confidence: 0.94,
      source_type: floorMode === 'zoom' ? 'zoom_sdk' : 'in_person_mic',
      is_reassigned: false,
      live_argument_draft: generateLiveArgumentDraft(text.trim(), activeDel.delegate_name)
    };

    const updatedSegments = [...segments, newSeg];
    const updatedProj: DebateProject = {
      ...project,
      transcript_segments: updatedSegments
    };

    saveProject(updatedProj);
    onUpdateProject(updatedProj);
    setSpeechInputText('');
  };

  // Add Custom Delegate to Roster
  const handleAddDelegate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDelName.trim()) return;

    const colors = ['#0078D4', '#DE2910', '#107C41', '#FFB900', '#8A2BE2', '#D83B01'];
    const randomColor = colors[roster.length % colors.length];

    const newDel: DelegateRosterItem = {
      delegate_id: `del-${Date.now()}`,
      delegate_name: newDelName.trim(),
      country_code: newDelCode.trim().toUpperCase() || 'UN',
      flag_emoji: '🏛️',
      color_accent: randomColor,
      is_speaking: false,
      total_speeches: 0
    };

    const updatedRoster = [...roster, newDel];
    const updatedProj: DebateProject = {
      ...project,
      roster: updatedRoster
    };

    saveProject(updatedProj);
    onUpdateProject(updatedProj);
    setSelectedDelegateId(newDel.delegate_id);
    setNewDelName('');
    setNewDelCode('');
    setShowAddDelegate(false);
  };

  // Connect Zoom Bot with Consent Gate
  const handleConnectZoom = async () => {
    if (!zoomHostConsentConfirmed) {
      alert('Host Consent Required: Please confirm host permission was obtained before connecting the Zoom bot.');
      return;
    }

    try {
      const status = await initZoomBot({
        meeting_id: zoomMeetingId,
        user_consent_confirmed: true,
        bot_display_name: 'DebatePrep Assistant (Notetaker)',
        use_wasapi_fallback: useWasapiFallback
      });
      setZoomBotStatus(status);
      setShowZoomConsentModal(false);
      setIsListening(true);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Export Session
  const handleExport = async () => {
    if (!positionDoc) return;
    const exportData = await exportSession(
      project.name,
      segments,
      positionDoc
    );
    setExportModalPayload(exportData);
  };

  return (
    <div className="live-assistant-view">
      {/* View Header */}
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <Users size={22} color="#0078D4" />
            Live Floor Assistant — {project.name}
          </h1>
          <p className="view-subtitle">
            Continuous floor transcription, quick-select delegate attribution, real-time counter-argument drafts, and live Committee Position Document.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            id="export-brief-btn"
            className="fluent-btn secondary" 
            onClick={handleExport}
            disabled={segments.length === 0}
          >
            <Download size={13} /> Export Session Brief
          </button>
        </div>
      </div>

      {/* Mode Switcher & Floor Control Bar */}
      <div className="fluent-card" style={{ background: '#1c1c1c' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Floor Mode Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Audio Source:</span>
            <button
              id="mode-in-person-btn"
              className={`fluent-btn secondary ${floorMode === 'in_person' ? 'active' : ''}`}
              style={{ fontSize: '12px', padding: '6px 14px', borderColor: floorMode === 'in_person' ? 'var(--fluent-accent)' : 'transparent' }}
              onClick={() => {
                setFloorMode('in_person');
                setZoomBotStatus(null);
              }}
            >
              <Mic size={14} /> In-Person Floor (Local Mic)
            </button>
            <button
              id="mode-zoom-btn"
              className={`fluent-btn secondary ${floorMode === 'zoom' ? 'active' : ''}`}
              style={{ fontSize: '12px', padding: '6px 14px', borderColor: floorMode === 'zoom' ? 'var(--fluent-accent)' : 'transparent' }}
              onClick={() => {
                setFloorMode('zoom');
                if (!zoomBotStatus?.is_connected) {
                  setShowZoomConsentModal(true);
                }
              }}
            >
              <Video size={14} /> Zoom / Online Floor Bot
            </button>
          </div>

          {/* Connection / Listening Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {floorMode === 'zoom' && zoomBotStatus?.is_connected ? (
              <span className="badge badge-verified" id="zoom-connected-badge">
                <CheckCircle2 size={12} /> {zoomBotStatus.active_mode}
              </span>
            ) : (
              <span className="badge badge-verified">
                <ShieldCheck size={12} /> Manual Quick-Select Attribution Active
              </span>
            )}

            <button
              id="floor-listen-toggle-btn"
              className={`fluent-btn ${isListening ? 'danger' : ''}`}
              onClick={() => setIsListening(!isListening)}
              style={{ minWidth: '130px' }}
            >
              {isListening ? (
                <>
                  <Pause size={14} /> Floor Listening Active
                </>
              ) : (
                <>
                  <Play size={14} /> Start Floor Listening
                </>
              )}
            </button>
          </div>
        </div>

        {/* Delegate Quick-Select Roster */}
        <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Delegate Quick-Select Roster (Tap active floor speaker):
            </span>
            <button
              className="fluent-btn secondary"
              style={{ fontSize: '10px', padding: '2px 8px' }}
              onClick={() => setShowAddDelegate(true)}
            >
              <Plus size={11} /> Add Custom Delegate
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {roster.map(del => {
              const isSelected = selectedDelegateId === del.delegate_id;
              return (
                <button
                  key={del.delegate_id}
                  id={`roster-${del.delegate_id}`}
                  className="fluent-btn secondary"
                  style={{
                    background: isSelected ? 'rgba(0, 120, 212, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                    borderColor: isSelected ? 'var(--fluent-accent)' : 'var(--border-subtle)',
                    borderLeft: `4px solid ${del.color_accent}`,
                    padding: '6px 12px',
                    fontSize: '12px'
                  }}
                  onClick={() => {
                    setSelectedDelegateId(del.delegate_id);
                    setAssistiveSuggestion(del.delegate_name);
                  }}
                >
                  <span style={{ fontSize: '14px' }}>{del.flag_emoji}</span>
                  <span style={{ fontWeight: isSelected ? 600 : 400 }}>{del.delegate_name}</span>
                  {isSelected && <UserCheck size={14} color="#60CDFF" style={{ marginLeft: '4px' }} />}
                </button>
              );
            })}
          </div>

          {/* Speech Input Box for active speaker */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <input
              type="text"
              className="fluent-input"
              style={{ flex: 1 }}
              placeholder={`Enter or transcribe statement by ${roster.find(d => d.delegate_id === selectedDelegateId)?.delegate_name || 'Active Speaker'}...`}
              value={speechInputText}
              onChange={e => setSpeechInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSpeech(speechInputText)}
            />
            <button
              id="record-speech-btn"
              className="fluent-btn"
              onClick={() => handleAddSpeech(speechInputText)}
              disabled={!speechInputText.trim()}
            >
              <Send size={13} /> Record Speech
            </button>
          </div>
        </div>
      </div>

      {/* Main Floor Grid */}
      {segments.length === 0 ? (
        /* Blank Slate Floor */
        <div className="fluent-card" style={{ textAlign: 'center', padding: '60px 20px', background: '#1c1c1c' }}>
          <MessageSquare size={32} color="#0078D4" style={{ margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
            The Floor is Silent
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 16px' }}>
            Select a delegate above and speak or type floor statements. The assistant will transcribe in real time, draft grounded counter-points, and automatically maintain your Committee Position Document.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
          {/* Left: Committee Position Document */}
          <div className="fluent-card" style={{ background: '#181818' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={16} color="#0078D4" />
                <h2 style={{ fontSize: '14px', fontWeight: 600 }}>
                  Committee Position Document
                </h2>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Updated: {positionDoc?.last_updated_timestamp || 'Live'}
              </span>
            </div>

            {/* Cross Contradictions Alert Matrix */}
            {positionDoc && positionDoc.cross_delegate_contradictions.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#ff9f0a', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={13} /> Active Contradiction Alerts Across Floor:
                </div>
                {positionDoc.cross_delegate_contradictions.map(contra => (
                  <div 
                    key={contra.alert_id}
                    id="contradiction-alert-box"
                    style={{
                      background: 'rgba(232, 17, 35, 0.15)',
                      border: '1px solid rgba(232, 17, 35, 0.35)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                      marginBottom: '8px'
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#FF99A4', fontSize: '12px' }}>
                      ⚠️ {contra.delegate_name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#E0E0E0', marginTop: '3px' }}>
                      {contra.contradiction_description}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Per-Delegate Dossiers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '520px', overflowY: 'auto' }}>
              {positionDoc?.delegates.map(del => (
                <div 
                  key={del.delegate_id}
                  id={`dossier-${del.delegate_id}`}
                  style={{
                    background: '#222222',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#fff' }}>
                      {del.delegate_name}
                    </div>
                    <span 
                      className="badge" 
                      style={{ 
                        fontSize: '9px',
                        background: del.confidence_status.includes('uncertain') ? 'rgba(216, 59, 1, 0.2)' : 'rgba(16, 124, 65, 0.2)',
                        color: del.confidence_status.includes('uncertain') ? '#ff9f0a' : '#4cd964'
                      }}
                    >
                      {del.confidence_status}
                    </span>
                  </div>

                  <div style={{ fontSize: '11px', color: '#60CDFF', marginBottom: '8px', fontWeight: 500 }}>
                    Stance: {del.overall_stance}
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>
                    Key Arguments Made:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {del.key_arguments.map((arg, aIdx) => (
                      <div 
                        key={aIdx} 
                        style={{ 
                          fontSize: '11px', 
                          color: '#D0D0D0', 
                          display: 'flex', 
                          alignItems: 'baseline', 
                          gap: '6px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          padding: '4px 6px',
                          borderRadius: '3px'
                        }}
                      >
                        <span style={{ color: '#60CDFF', fontWeight: 600 }}>
                          [{arg.timestamp_str}]
                        </span>
                        <span>{arg.summary_text}</span>
                        {arg.is_uncertain && (
                          <span className="badge badge-uncertain" style={{ fontSize: '8px', padding: '1px 4px' }}>
                            [uncertain – verify]
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {del.internal_contradictions.length > 0 && (
                    <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: '#FF99A4', textTransform: 'uppercase' }}>
                        ⚠️ Contradiction Detected:
                      </div>
                      {del.internal_contradictions.map((con, cIdx) => (
                        <div key={cIdx} style={{ fontSize: '11px', color: '#ffb3ba', marginTop: '2px' }}>
                          [{con.timestamp_str}] {con.summary_text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Live Transcript & Counter-Drafts */}
          <div className="fluent-card" style={{ background: '#181818' }}>
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', marginBottom: '14px' }}>
              <button
                className={`fluent-btn secondary ${activeTab === 'live_transcript' ? 'active' : ''}`}
                style={{ fontSize: '11px', padding: '4px 10px', borderColor: activeTab === 'live_transcript' ? 'var(--fluent-accent)' : 'transparent' }}
                onClick={() => setActiveTab('live_transcript')}
              >
                <MessageSquare size={13} /> Live Floor Transcript ({segments.length})
              </button>
              <button
                className={`fluent-btn secondary ${activeTab === 'argument_drafts' ? 'active' : ''}`}
                style={{ fontSize: '11px', padding: '4px 10px', borderColor: activeTab === 'argument_drafts' ? 'var(--fluent-accent)' : 'transparent' }}
                onClick={() => setActiveTab('argument_drafts')}
              >
                <Zap size={13} color="#FFB900" /> Fast Grounded Counter-Drafts
              </button>
            </div>

            {activeTab === 'live_transcript' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '520px', overflowY: 'auto' }}>
                {segments.map(seg => (
                  <div 
                    key={seg.segment_id}
                    id={seg.segment_id}
                    style={{
                      background: '#222222',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                      borderLeft: seg.is_reassigned ? '3px solid #FFB900' : '3px solid var(--fluent-accent)',
                      borderTop: '1px solid var(--border-subtle)',
                      borderRight: '1px solid var(--border-subtle)',
                      borderBottom: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '10px', color: '#60CDFF', fontWeight: 600 }}>
                          <Clock size={10} style={{ display: 'inline', marginRight: '2px' }} />
                          {seg.timestamp_str}
                        </span>
                        <strong style={{ fontSize: '12px', color: '#fff' }}>
                          {seg.delegate_name}
                        </strong>
                        {seg.is_reassigned && (
                          <span className="badge badge-niche" style={{ fontSize: '8px', padding: '0 4px' }}>
                            reassigned
                          </span>
                        )}
                      </div>

                      {/* Reassign Dropdown */}
                      <select
                        id={`reassign-select-${seg.segment_id}`}
                        className="fluent-input"
                        style={{ padding: '2px 6px', fontSize: '10px', height: '22px' }}
                        value={seg.delegate_id}
                        onChange={e => handleReassignSegment(seg.segment_id, e.target.value)}
                      >
                        {roster.map(r => (
                          <option key={r.delegate_id} value={r.delegate_id}>
                            {r.delegate_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <p style={{ fontSize: '12px', color: '#E0E0E0', lineHeight: '1.5' }}>
                      "{seg.text}"
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '520px', overflowY: 'auto' }}>
                {segments.map(seg => {
                  const draft = seg.live_argument_draft;
                  if (!draft) return null;
                  return (
                    <div 
                      key={seg.segment_id}
                      style={{
                        background: '#222222',
                        borderRadius: 'var(--radius-sm)',
                        padding: '12px',
                        border: '1px solid var(--border-subtle)',
                        borderLeft: '3px solid #FFB900'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#FFB900', fontWeight: 600 }}>
                          Counter to {seg.delegate_name} [{seg.timestamp_str}]
                        </span>
                        <span className="badge badge-verified" style={{ fontSize: '9px' }}>
                          {draft.confidence_tag}
                        </span>
                      </div>

                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>
                        Angle: {draft.counter_angle}
                      </div>

                      <p style={{ fontSize: '12px', color: '#D0D0D0', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '4px', marginBottom: '6px' }}>
                        <strong>POI / Rebuttal:</strong> "{draft.poi_draft}"
                      </p>

                      <div style={{ fontSize: '10px', color: '#60CDFF' }}>
                        <strong>Citation:</strong> {draft.grounded_citation}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Custom Delegate Modal */}
      {showAddDelegate && (
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
          <div className="fluent-card" style={{ width: '420px', background: '#202020', border: '1px solid var(--fluent-accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600 }}>Add Delegate to Floor Roster</h2>
              <button className="fluent-btn secondary" style={{ padding: '2px 8px' }} onClick={() => setShowAddDelegate(false)}>✕</button>
            </div>

            <form onSubmit={handleAddDelegate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Delegate Name / State</label>
                <input
                  type="text"
                  required
                  className="fluent-input"
                  style={{ width: '100%', marginTop: '4px' }}
                  placeholder="e.g. Delegate of Japan or Rapporteur"
                  value={newDelName}
                  onChange={e => setNewDelName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Country / Org Code</label>
                <input
                  type="text"
                  className="fluent-input"
                  style={{ width: '100%', marginTop: '4px' }}
                  placeholder="e.g. JP"
                  value={newDelCode}
                  onChange={e => setNewDelCode(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="fluent-btn secondary" onClick={() => setShowAddDelegate(false)}>Cancel</button>
                <button type="submit" className="fluent-btn">Add Delegate</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Zoom On-Join Consent Modal */}
      {showZoomConsentModal && (
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
          zIndex: 1000
        }}>
          <div className="fluent-card" style={{ width: '480px', background: '#202020', border: '1px solid var(--fluent-accent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Video size={20} color="#0078D4" />
              <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Zoom Notetaker Bot Join & Consent Gate</h2>
            </div>

            <p style={{ fontSize: '12px', color: '#D0D0D0', marginBottom: '14px', lineHeight: '1.5' }}>
              The debate prep assistant will join the meeting visibly named:
              <strong style={{ display: 'block', color: '#60CDFF', margin: '4px 0' }}>
                DebatePrep Assistant (Notetaker)
              </strong>
              It will separate statements by participant identity metadata provided by the Zoom Meeting SDK.
            </p>

            <div style={{ 
              background: 'rgba(232, 17, 35, 0.1)', 
              border: '1px solid rgba(232, 17, 35, 0.3)', 
              padding: '10px', 
              borderRadius: 'var(--radius-sm)',
              marginBottom: '14px' 
            }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#fff' }}>
                <input
                  id="zoom-consent-checkbox"
                  type="checkbox"
                  style={{ marginTop: '3px' }}
                  checked={zoomHostConsentConfirmed}
                  onChange={e => setZoomHostConsentConfirmed(e.target.checked)}
                />
                <span>
                  <strong>Host & Floor Permission Confirmed:</strong> I certify that host permission and floor participant consent have been obtained to connect this notetaker bot to this session.
                </span>
              </label>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-muted)' }}>
                <input
                  type="checkbox"
                  checked={useWasapiFallback}
                  onChange={e => setUseWasapiFallback(e.target.checked)}
                />
                <span>Use WASAPI System-Audio Loopback Fallback (lacks participant identity separation)</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="fluent-btn secondary"
                onClick={() => setShowZoomConsentModal(false)}
              >
                Cancel
              </button>
              <button
                id="confirm-zoom-join-btn"
                className="fluent-btn"
                disabled={!zoomHostConsentConfirmed}
                onClick={handleConnectZoom}
              >
                Join & Start Floor Assistant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {exportModalPayload && (
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
          zIndex: 1000
        }}>
          <div className="fluent-card" style={{ width: '600px', maxHeight: '80vh', background: '#202020', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600 }}>Export Session Brief</h2>
              <button className="fluent-btn secondary" style={{ padding: '2px 8px' }} onClick={() => setExportModalPayload(null)}>✕</button>
            </div>

            <textarea
              readOnly
              style={{
                flex: 1,
                minHeight: '280px',
                background: '#141414',
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: '11px',
                padding: '10px',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                marginBottom: '12px'
              }}
              value={exportModalPayload.markdown_content}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button 
                className="fluent-btn secondary" 
                onClick={() => {
                  navigator.clipboard.writeText(exportModalPayload.markdown_content);
                  alert('Markdown copied to clipboard!');
                }}
              >
                Copy Markdown
              </button>
              <button 
                className="fluent-btn secondary" 
                onClick={() => {
                  navigator.clipboard.writeText(exportModalPayload.json_content);
                  alert('JSON copied to clipboard!');
                }}
              >
                Copy JSON
              </button>
              <button 
                className="fluent-btn" 
                onClick={() => setExportModalPayload(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
