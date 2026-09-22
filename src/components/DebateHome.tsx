import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  BookOpen, 
  Clock, 
  Calendar, 
  ShieldAlert, 
  Trash2, 
  FolderOpen, 
  Sparkles, 
  UploadCloud, 
  Layers,
  ArrowRight,
  ShieldCheck,
  Download,
  Upload,
  Search,
  Copy,
  Database,
  HardDrive
} from 'lucide-react';
import { DebateProject } from '../types';
import { 
  createBlankProject, 
  listProjects, 
  deleteProject, 
  duplicateProject,
  exportVaultToJson, 
  importVaultFromJson,
  getStorageMetrics,
  StorageMetrics,
  onVaultProjectsChange
} from '../services/cloudVault';

interface DebateHomeProps {
  onSelectProject: (project: DebateProject) => void;
}

export const DebateHome: React.FC<DebateHomeProps> = ({ onSelectProject }) => {
  const [projects, setProjects] = useState<DebateProject[]>(listProjects());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [metrics, setMetrics] = useState<StorageMetrics | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [committee, setCommittee] = useState('');
  const [motion, setMotion] = useState('');
  const [freezeDate, setFreezeDate] = useState('');
  const [useFreezeDate, setUseFreezeDate] = useState(false);
  const [excludeWikipedia, setExcludeWikipedia] = useState(true);

  // Subscribe to storage changes and calculate metrics
  useEffect(() => {
    getStorageMetrics().then(setMetrics).catch(() => {});
    return onVaultProjectsChange((updatedProjects) => {
      setProjects(updatedProjects);
      getStorageMetrics().then(setMetrics).catch(() => {});
    });
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const excluded = ['wikipedia.org', 'en.wikipedia.org'];
    const newProj = createBlankProject({
      name: name.trim(),
      committee: committee.trim() || 'General Floor',
      motion: motion.trim() || 'Open Floor Debate',
      freeze_date: useFreezeDate && freezeDate ? freezeDate : undefined,
      excluded_sources: excludeWikipedia ? excluded : []
    });

    setProjects(listProjects());
    setShowCreateModal(false);
    onSelectProject(newProj);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this debate project from Cloud Vault?')) {
      deleteProject(id);
      setProjects(listProjects());
    }
  };

  const handleDuplicate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cloned = duplicateProject(id);
    if (cloned) {
      setProjects(listProjects());
    }
  };

  const handleExportVault = () => {
    const jsonStr = exportVaultToJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debate-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportVault = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content && importVaultFromJson(content)) {
        setProjects(listProjects());
        alert('Cloud Vault backup successfully restored!');
      } else {
        alert('Failed to import backup: Invalid vault file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filteredProjects = projects.filter(p => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.committee.toLowerCase().includes(q) ||
      p.motion.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', padding: '36px 20px' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="suite-badge">Debate Prep Suite</span>
            <span style={{ fontSize: '11px', color: '#60CDFF', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Database size={13} /> {metrics?.engine || 'Enterprise Storage'}
            </span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.5px' }}>
            Debate Projects Hub
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Enterprise transactional storage with zero 5MB limits. Create clean debates, upload files, and access your dossiers anytime.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            id="export-vault-btn"
            className="fluent-btn secondary"
            style={{ padding: '8px 12px', fontSize: '12px', height: '38px', gap: '6px' }}
            title="Export full Cloud Vault to a JSON backup package"
            onClick={handleExportVault}
          >
            <Download size={14} /> Export Backup
          </button>
          <label
            id="import-vault-btn"
            className="fluent-btn secondary"
            style={{ padding: '8px 12px', fontSize: '12px', height: '38px', gap: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
            title="Import and restore Cloud Vault from a JSON backup file"
          >
            <Upload size={14} /> Import Backup
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportVault}
            />
          </label>
          <button
            id="create-debate-btn"
            className="fluent-btn"
            style={{ padding: '8px 16px', fontSize: '13px', height: '38px', gap: '6px' }}
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={15} /> New Debate Project
          </button>
        </div>
      </div>

      {/* Storage Health & Statistics Ribbon */}
      {metrics && (
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 14px',
            marginBottom: '20px',
            fontSize: '11px',
            color: 'var(--text-secondary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#60CDFF' }}>
              <HardDrive size={13} /> {metrics.usageFormatted} allocated
            </span>
            <span>•</span>
            <span>{metrics.projectCount} Debates</span>
            <span>•</span>
            <span>{metrics.totalDocuments} Working Documents</span>
            <span>•</span>
            <span>{metrics.totalWords.toLocaleString()} Words Indexed</span>
          </div>
          <div style={{ color: '#4cd964', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={13} /> Transactional Safety Guaranteed
          </div>
        </div>
      )}

      {/* Filter / Search Bar */}
      {projects.length > 0 && (
        <div style={{ position: 'relative', marginBottom: '18px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
          <input
            id="filter-debates-input"
            type="text"
            className="fluent-input"
            placeholder="Search debates by name, committee, or motion..."
            style={{ width: '100%', paddingLeft: '34px', height: '36px', fontSize: '12px' }}
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
          />
        </div>
      )}

      {/* Projects Grid / Empty State */}
      {projects.length === 0 ? (
        <div className="fluent-card" style={{ textAlign: 'center', padding: '60px 20px', background: '#1c1c1c' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(0, 120, 212, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <FolderOpen size={28} color="#0078D4" />
          </div>
          <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
            No Debate Projects in Storage
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 20px' }}>
            Start completely clean. Set your debate motion, name your committee, and upload custom working papers or run deep grounded research.
          </p>
          <button
            className="fluent-btn"
            style={{ padding: '8px 20px' }}
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={14} /> Start Your First Debate
          </button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="fluent-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            No debates match &ldquo;{filterQuery}&rdquo;.
          </p>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={12} /> Active Debates ({filteredProjects.length})
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {filteredProjects.map(proj => (
              <div
                key={proj.id}
                id={`project-card-${proj.id}`}
                className="fluent-card"
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '185px',
                  background: '#202020',
                  border: '1px solid var(--border-subtle)',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => onSelectProject(proj)}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span className="badge badge-verified" style={{ fontSize: '9px' }}>
                      {proj.committee}
                    </span>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      <button
                        className="fluent-btn secondary"
                        style={{ padding: '4px 6px', background: 'transparent', border: 'none', color: '#888' }}
                        title="Duplicate this debate project"
                        onClick={e => handleDuplicate(proj.id, e)}
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        className="fluent-btn secondary"
                        style={{ padding: '4px 6px', background: 'transparent', border: 'none', color: '#888' }}
                        title="Delete debate"
                        onClick={e => handleDelete(proj.id, e)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
                    {proj.name}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '12px' }}>
                    {proj.motion.length > 85 ? `${proj.motion.substring(0, 82)}...` : proj.motion}
                  </p>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span title="Documents count">
                      📄 {proj.documents?.length || 0} docs
                    </span>
                    <span title="Approved research angles">
                      ✨ {proj.approved_research?.length || 0} approved
                    </span>
                    <span title="Speeches recorded">
                      🎙️ {proj.transcript_segments?.length || 0} speeches
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#60CDFF', fontWeight: 500 }}>
                    <span>Open</span>
                    <ArrowRight size={12} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Debate Modal */}
      {showCreateModal && (
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
          <div className="fluent-card" style={{ width: '480px', background: '#222', border: '1px solid var(--fluent-accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color="#60CDFF" />
                <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Create New Debate Project</h2>
              </div>
              <button className="fluent-btn secondary" style={{ padding: '2px 8px' }} onClick={() => setShowCreateModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>
                  Debate / Tournament Name: *
                </label>
                <input
                  id="create-debate-name-input"
                  type="text"
                  required
                  className="fluent-input"
                  style={{ width: '100%', marginTop: '4px' }}
                  placeholder="e.g. Oxford IV 2026 Finals / UNSC AI Resolution"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>
                  Committee / Division:
                </label>
                <input
                  id="create-debate-committee-input"
                  type="text"
                  className="fluent-input"
                  style={{ width: '100%', marginTop: '4px' }}
                  placeholder="e.g. UN Security Council, ECOSOC, World Schools"
                  value={committee}
                  onChange={e => setCommittee(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>
                  Motion / Topic:
                </label>
                <textarea
                  id="create-debate-motion-input"
                  className="fluent-input"
                  rows={2}
                  style={{ width: '100%', marginTop: '4px', resize: 'vertical' }}
                  placeholder="e.g. This House Would mandate cryptographic proof-of-safety on frontier compute..."
                  value={motion}
                  onChange={e => setMotion(e.target.value)}
                />
              </div>

              {/* Committee Governance Rules */}
              <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="modal-freeze-toggle"
                    checked={useFreezeDate}
                    onChange={e => setUseFreezeDate(e.target.checked)}
                  />
                  <label htmlFor="modal-freeze-toggle" style={{ fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={13} color="#60CDFF" />
                    <span>Committee Freeze Date:</span>
                  </label>
                  <input
                    type="date"
                    className="fluent-input"
                    style={{ padding: '2px 6px', fontSize: '11px' }}
                    value={freezeDate}
                    disabled={!useFreezeDate}
                    onChange={e => setFreezeDate(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="modal-wiki-toggle"
                    checked={excludeWikipedia}
                    onChange={e => setExcludeWikipedia(e.target.checked)}
                  />
                  <label htmlFor="modal-wiki-toggle" style={{ fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldAlert size={13} color="#FFB900" />
                    <span>Enforce No-Wikipedia Sourcing Rule</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button type="button" className="fluent-btn secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button id="submit-create-debate-btn" type="submit" className="fluent-btn">
                  Create Blank Debate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
