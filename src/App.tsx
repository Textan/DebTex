import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Volume2, 
  Users, 
  Settings, 
  Layers, 
  Search,
  ExternalLink,
  Keyboard,
  UploadCloud,
  ArrowLeft,
  CheckCircle2,
  FolderOpen
} from 'lucide-react';
import { DebateProject, ResearchAngle, ApprovedResearchAngle } from './types';
import { 
  getActiveProjectId, 
  getProject, 
  saveProject, 
  addApprovedResearchToDocument,
  onSyncStatusChange,
  SyncStatus,
  setActiveProjectId 
} from './services/cloudVault';
import { DebateHome } from './components/DebateHome';
import { DeepResearchEngine } from './components/DeepResearchEngine';
import { VoiceDocumentSearch } from './components/VoiceDocumentSearch';
import { LiveDebateAssistant } from './components/LiveDebateAssistant';
import { SettingsModal } from './components/SettingsModal';

export const App: React.FC = () => {
  const [activeProject, setActiveProject] = useState<DebateProject | null>(() => {
    const savedId = getActiveProjectId();
    return savedId ? getProject(savedId) : null;
  });

  const [activeTab, setActiveTab] = useState<'deep_research' | 'voice_search' | 'live_assistant'>('deep_research');
  const [showSettings, setShowSettings] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');

  // Listen to cloud sync events
  useEffect(() => {
    return onSyncStatusChange((status) => {
      setSyncStatus(status);
    });
  }, []);

  // Global Windows-native Keyboard Shortcuts (Ctrl+1, Ctrl+2, Ctrl+3, Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === '1') {
          e.preventDefault();
          setActiveTab('deep_research');
        } else if (e.key === '2') {
          e.preventDefault();
          setActiveTab('voice_search');
        } else if (e.key === '3') {
          e.preventDefault();
          setActiveTab('live_assistant');
        } else if (e.key === 'k' || e.key === 'K') {
          e.preventDefault();
          if (activeTab === 'deep_research') {
            document.getElementById('research-topic-input')?.focus();
          } else if (activeTab === 'voice_search') {
            document.getElementById('doc-search-input')?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  // Project Switch / Home Action
  const handleBackToHome = () => {
    setActiveProjectId(null);
    setActiveProject(null);
  };

  const handleSelectProject = (proj: DebateProject) => {
    setActiveProject(proj);
    setActiveProjectId(proj.id);
  };

  // Handler: Research in Part 1 approved ➔ Added to Document in Part 2
  const handleApproveAngle = (angle: ResearchAngle) => {
    if (!activeProject) return;

    const approvedItem: ApprovedResearchAngle = {
      id: `appr-${Date.now()}`,
      angle_id: angle.id,
      title: angle.title,
      stance: angle.stance,
      is_niche: angle.is_niche,
      summary: angle.summary,
      approved_at: new Date().toISOString(),
      factual_claims: angle.factual_claims,
      sources: angle.sources
    };

    const updated = addApprovedResearchToDocument(activeProject, approvedItem);
    setActiveProject(updated);
  };

  // Render Home if no active debate project is selected
  if (!activeProject) {
    return (
      <div className="app-container">
        <header className="fluent-titlebar">
          <div className="titlebar-brand">
            <span className="suite-badge">Debate Suite</span>
            <span style={{ color: '#E0E0E0' }}>Debate Prep Suite</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>— Windows Native</span>
          </div>
          <div className="titlebar-actions">
            <button 
              className="fluent-btn secondary" 
              style={{ padding: '3px 8px', fontSize: '11px' }}
              onClick={() => setShowSettings(true)}
            >
              <Settings size={13} /> Settings
            </button>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <DebateHome onSelectProject={handleSelectProject} />
        </div>

        <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      </div>
    );
  }

  // Render Active Debate Project Workspace
  return (
    <div className="app-container">
      {/* Fluent Window Titlebar with Project Name and Cloud Status */}
      <header className="fluent-titlebar">
        <div className="titlebar-brand">
          <button
            className="fluent-btn secondary"
            style={{ padding: '3px 8px', fontSize: '11px', marginRight: '6px' }}
            onClick={handleBackToHome}
            title="Return to Projects Hub"
          >
            <ArrowLeft size={12} /> Debates Hub
          </button>
          <span className="suite-badge">Active</span>
          <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{activeProject.name}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({activeProject.committee})</span>
        </div>

        <div className="titlebar-actions">
          {/* Cloud Sync Status Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#60CDFF', marginRight: '10px' }}>
            <UploadCloud size={13} />
            <span>
              {syncStatus === 'saving' ? 'Syncing to Cloud...' : '☁️ Synced to Cloud Vault'}
            </span>
          </div>

          <button 
            id="open-settings-btn"
            className="fluent-btn secondary" 
            style={{ padding: '3px 8px', fontSize: '11px' }}
            onClick={() => setShowSettings(true)}
            title="Credential Manager & Settings"
          >
            <Settings size={13} /> Settings
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="app-body">
        {/* Windows Fluent Sidebar Navigation */}
        <nav className="fluent-sidebar">
          <div className="nav-group">
            <div className="nav-section-title">Debate Engines</div>
            
            <button 
              id="nav-deep-research-btn"
              className={`nav-item ${activeTab === 'deep_research' ? 'active' : ''}`}
              onClick={() => setActiveTab('deep_research')}
            >
              <Sparkles size={16} />
              <span>1. Deep Research</span>
              <span className="nav-shortcut">Ctrl+1</span>
            </button>

            <button 
              id="nav-voice-search-btn"
              className={`nav-item ${activeTab === 'voice_search' ? 'active' : ''}`}
              onClick={() => setActiveTab('voice_search')}
            >
              <Volume2 size={16} />
              <span>2. Voice Doc Search</span>
              <span className="nav-shortcut">Ctrl+2</span>
            </button>

            <button 
              id="nav-live-assistant-btn"
              className={`nav-item ${activeTab === 'live_assistant' ? 'active' : ''}`}
              onClick={() => setActiveTab('live_assistant')}
            >
              <Users size={16} />
              <span>3. Live Floor Assistant</span>
              <span className="nav-shortcut">Ctrl+3</span>
            </button>

            {/* Project Summary in Sidebar */}
            <div className="nav-section-title" style={{ marginTop: '16px' }}>Project Dossier</div>
            <div style={{ 
              padding: '10px', 
              background: 'rgba(255,255,255,0.02)', 
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              fontSize: '11px',
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div>
                <strong style={{ color: '#fff' }}>Motion:</strong>
                <div style={{ color: '#D0D0D0', fontSize: '11px', marginTop: '2px', lineHeight: '1.3' }}>
                  {activeProject.motion}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px', marginTop: '4px' }}>
                <span>Documents:</span>
                <strong style={{ color: '#60CDFF' }}>{activeProject.documents.length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Approved Research:</span>
                <strong style={{ color: '#FFB900' }}>{activeProject.approved_research.length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Floor Speeches:</span>
                <strong style={{ color: '#4CD964' }}>{activeProject.transcript_segments.length}</strong>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div style={{ padding: '8px 10px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Keyboard size={12} /> Press <kbd style={{ background: '#333', padding: '1px 4px', borderRadius: '3px' }}>Ctrl+K</kbd> to search
            </div>
          </div>
        </nav>

        {/* Dynamic Main Workspace View */}
        <main className="main-view-container">
          {activeTab === 'deep_research' && (
            <DeepResearchEngine 
              project={activeProject} 
              onApproveAngle={handleApproveAngle} 
            />
          )}
          {activeTab === 'voice_search' && (
            <VoiceDocumentSearch 
              project={activeProject} 
              onUpdateProject={setActiveProject} 
            />
          )}
          {activeTab === 'live_assistant' && (
            <LiveDebateAssistant 
              project={activeProject} 
              onUpdateProject={setActiveProject} 
            />
          )}
        </main>
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};
