import React, { useState } from 'react';
import { 
  Search, 
  Calendar, 
  ShieldAlert, 
  Sparkles, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Globe, 
  Filter,
  Layers,
  PlusCircle,
  Check
} from 'lucide-react';
import { ResearchAngle, ResearchResult, DebateProject } from '../types';
import { runDeepResearch } from '../services/api';

interface DeepResearchEngineProps {
  project: DebateProject;
  onApproveAngle: (angle: ResearchAngle) => void;
}

export const DeepResearchEngine: React.FC<DeepResearchEngineProps> = ({ 
  project, 
  onApproveAngle 
}) => {
  const [topic, setTopic] = useState(project.motion || '');
  const [freezeDate, setFreezeDate] = useState(project.freeze_date || '2024-01-01');
  const [useFreezeDate, setUseFreezeDate] = useState(!!project.freeze_date);
  const [excludeWikipedia, setExcludeWikipedia] = useState(
    project.excluded_sources?.includes('wikipedia.org') ?? true
  );
  const [customExclusions, setCustomExclusions] = useState(
    project.excluded_sources?.join(', ') || 'wikipedia.org, en.wikipedia.org'
  );
  
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ResearchResult | null>(null);
  const [activeStanceFilter, setActiveStanceFilter] = useState<'All' | 'Pro' | 'Con' | 'Third-Way'>('All');

  // Check if an angle is already approved in this project
  const isAngleApproved = (angleId: string) => {
    return project.approved_research.some(a => a.angle_id === angleId);
  };

  const handleSearch = async () => {
    if (!topic.trim()) return;
    setIsLoading(true);

    const exclusions = customExclusions
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (excludeWikipedia && !exclusions.includes('wikipedia.org')) {
      exclusions.push('wikipedia.org', 'en.wikipedia.org');
    }

    try {
      const data = await runDeepResearch({
        topic: topic.trim(),
        freeze_date: useFreezeDate ? freezeDate : undefined,
        excluded_sources: exclusions,
        committee_name: project.committee
      });
      setResults(data);
    } catch (err) {
      console.error('Research query failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAngles = results?.angles.filter(angle => {
    if (activeStanceFilter === 'All') return true;
    return angle.stance === activeStanceFilter;
  }) || [];

  return (
    <div className="research-engine-view">
      {/* Header Banner */}
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <Sparkles size={22} color="#0078D4" />
            Deep Research Engine — {project.name}
          </h1>
          <p className="view-subtitle">
            Synthesize verified, non-obvious argument angles. Approved research is directly compiled into Part 2's working document.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="badge badge-verified">
            <CheckCircle2 size={12} /> Grounding Rule Enforced
          </span>
          <span className="badge badge-niche">
            <Sparkles size={12} /> Niche Angle Synthesis Active
          </span>
        </div>
      </div>

      {/* Query Formulation Card */}
      <div className="fluent-card" style={{ background: '#1c1c1c' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Topic Search Input */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search 
                size={16} 
                style={{ position: 'absolute', left: 12, top: 11, color: '#8E8E93' }} 
              />
              <input
                id="research-topic-input"
                type="text"
                className="fluent-input"
                style={{ width: '100%', paddingLeft: '36px', fontSize: '13px' }}
                placeholder="Enter debate motion, argument clause, or research inquiry..."
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <button 
              id="run-research-btn"
              className="fluent-btn" 
              onClick={handleSearch}
              disabled={isLoading || !topic.trim()}
              style={{ minWidth: '150px' }}
            >
              {isLoading ? (
                <>
                  <div className="waveform-bar" style={{ height: '12px' }} />
                  Synthesizing...
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Run Deep Research
                </>
              )}
            </button>
          </div>

          {/* Governance & Rules Bar: Freeze Date & Domain Exclusions */}
          <div style={{ 
            display: 'flex', 
            gap: '18px', 
            padding: '12px 14px', 
            background: 'rgba(0, 0, 0, 0.25)', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--border-subtle)',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            {/* Freeze Date Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                id="freeze-toggle" 
                checked={useFreezeDate}
                onChange={e => setUseFreezeDate(e.target.checked)}
              />
              <label htmlFor="freeze-toggle" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
                <Calendar size={14} color="#60CDFF" />
                <strong>Freeze Date:</strong>
              </label>
              <input
                id="freeze-date-input"
                type="date"
                className="fluent-input"
                style={{ padding: '3px 8px', fontSize: '11px', color: useFreezeDate ? '#fff' : '#666' }}
                value={freezeDate}
                disabled={!useFreezeDate}
                onChange={e => setFreezeDate(e.target.value)}
              />
            </div>

            {/* Wikipedia Exclusion */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                id="wiki-toggle" 
                checked={excludeWikipedia}
                onChange={e => setExcludeWikipedia(e.target.checked)}
              />
              <label htmlFor="wiki-toggle" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
                <ShieldAlert size={14} color="#FFB900" />
                <span>Strict No-Wikipedia Sourcing</span>
              </label>
            </div>

            {/* Excluded Domains Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
              <Filter size={13} color="#8E8E93" />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Excluded Domains:</span>
              <input
                type="text"
                className="fluent-input"
                style={{ width: '210px', padding: '3px 8px', fontSize: '11px' }}
                value={customExclusions}
                onChange={e => setCustomExclusions(e.target.value)}
                placeholder="domain1.com, domain2.org"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Empty State before search */}
      {!results && !isLoading && (
        <div className="fluent-card" style={{ textAlign: 'center', padding: '50px 20px', background: '#1c1c1c' }}>
          <Sparkles size={32} color="#0078D4" style={{ margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
            Blank Research Workspace
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto' }}>
            Enter your debate topic or argument premise above. The engine will query web sources, enforce your freeze date and sourcing exclusions, synthesize grounded arguments, and surface niche angles.
          </p>
        </div>
      )}

      {/* Results View */}
      {results && (
        <div style={{ marginTop: '20px' }}>
          {/* Metadata Banner */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '14px', 
            padding: '10px 14px', 
            background: '#1a1a1a', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--border-subtle)' 
          }}>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Globe size={14} color="#0078D4" />
                Provider: <strong>{results.provider_used}</strong>
              </span>
              <span>
                Sources Evaluated: <strong>{results.total_sources_evaluated}</strong>
              </span>
              {results.filtered_out_freeze_date > 0 && (
                <span style={{ color: '#60CDFF' }}>
                  🚫 Post-Freeze Filtered (&gt; {results.freeze_date_applied}): <strong>{results.filtered_out_freeze_date}</strong>
                </span>
              )}
              {results.filtered_out_excluded_domains > 0 && (
                <span style={{ color: '#FFB900' }}>
                  🚫 Excluded Domains Filtered: <strong>{results.filtered_out_excluded_domains}</strong>
                </span>
              )}
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['All', 'Pro', 'Con', 'Third-Way'] as const).map(tab => (
                <button
                  key={tab}
                  className={`fluent-btn secondary ${activeStanceFilter === tab ? 'active' : ''}`}
                  style={{ 
                    fontSize: '11px', 
                    padding: '3px 10px',
                    borderColor: activeStanceFilter === tab ? 'var(--fluent-accent)' : 'transparent' 
                  }}
                  onClick={() => setActiveStanceFilter(tab)}
                >
                  {tab === 'All' ? `All (${results.angles.length})` : tab}
                </button>
              ))}
            </div>
          </div>

          {/* Sourced Argument Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredAngles.map(angle => {
              const approved = isAngleApproved(angle.id);

              return (
                <div 
                  key={angle.id} 
                  className={`fluent-card ${angle.is_niche ? 'niche-card' : ''}`}
                  style={{ 
                    borderLeft: angle.is_niche ? '4px solid var(--niche-accent)' : '4px solid var(--fluent-accent)',
                    background: angle.is_niche ? '#242118' : '#202020'
                  }}
                >
                  {/* Angle Header & Approve Action */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {angle.is_niche && (
                        <span className="badge badge-niche" id="niche-badge">
                          <Sparkles size={11} /> [NICHE / NON-OBVIOUS ANGLE]
                        </span>
                      )}
                      <span 
                        className="badge" 
                        style={{ 
                          backgroundColor: angle.stance === 'Pro' ? 'rgba(0, 120, 212, 0.2)' : angle.stance === 'Con' ? 'rgba(232, 17, 35, 0.2)' : 'rgba(128, 90, 213, 0.2)',
                          color: angle.stance === 'Pro' ? '#60CDFF' : angle.stance === 'Con' ? '#FF99A4' : '#D6BCFA'
                        }}
                      >
                        {angle.stance} Stance
                      </span>
                      <span className="badge badge-verified">
                        Confidence: {(angle.confidence_score * 100).toFixed(0)}%
                      </span>

                      {approved && (
                        <span className="badge badge-verified" style={{ background: 'rgba(16, 124, 65, 0.3)', color: '#68D391' }}>
                          <Check size={11} /> Added to Working Document
                        </span>
                      )}
                    </div>

                    {/* Approve & Add to Part 2 Working Document Button */}
                    <button
                      id={`approve-angle-btn-${angle.id}`}
                      className={`fluent-btn ${approved ? 'secondary' : ''}`}
                      style={{ fontSize: '11px', padding: '4px 12px' }}
                      onClick={() => onApproveAngle(angle)}
                      disabled={approved}
                    >
                      {approved ? (
                        <>
                          <Check size={12} /> Approved (In Part 2)
                        </>
                      ) : (
                        <>
                          <PlusCircle size={12} /> Approve & Add to Document
                        </>
                      )}
                    </button>
                  </div>

                  {/* Angle Title & Summary */}
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
                    {angle.title}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.6' }}>
                    {angle.summary}
                  </p>

                  {/* Grounded Factual Claims with Explicit Source Citations */}
                  <div style={{ 
                    background: 'rgba(0, 0, 0, 0.3)', 
                    padding: '12px', 
                    borderRadius: 'var(--radius-sm)', 
                    marginBottom: '12px' 
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Layers size={13} /> Sourced Factual Evidence & Grounding
                    </div>
                    <ul style={{ listStyleType: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {angle.factual_claims.map((claim, cIdx) => (
                        <li key={cIdx} style={{ fontSize: '12px', color: '#E0E0E0', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          {claim.is_uncertain ? (
                            <AlertCircle size={14} color="#ff9f0a" style={{ marginTop: '2px', flexShrink: 0 }} />
                          ) : (
                            <CheckCircle2 size={14} color="#4cd964" style={{ marginTop: '2px', flexShrink: 0 }} />
                          )}
                          <div>
                            <span>{claim.claim_text.split('[Source:')[0]}</span>
                            {claim.is_uncertain && (
                              <span className="badge badge-uncertain" style={{ marginLeft: '4px', fontSize: '9px' }}>
                                [uncertain]
                              </span>
                            )}
                            <a 
                              href={claim.citation.url} 
                              target="_blank" 
                              rel="noreferrer"
                              style={{ 
                                color: '#60CDFF', 
                                marginLeft: '6px', 
                                textDecoration: 'none', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '3px',
                                fontWeight: 500
                              }}
                            >
                              [Source: {claim.citation.title}] <ExternalLink size={10} />
                            </a>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Validated Sources Tray */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Validated Sources:</span>
                    {angle.sources.map((src, sIdx) => (
                      <a
                        key={sIdx}
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ 
                          fontSize: '11px', 
                          color: 'var(--text-secondary)', 
                          background: 'rgba(255, 255, 255, 0.05)', 
                          padding: '3px 8px', 
                          borderRadius: '3px',
                          textDecoration: 'none',
                          border: '1px solid var(--border-subtle)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Globe size={11} color="#60CDFF" />
                        {src.domain} {src.publication_date ? `(${src.publication_date})` : ''}
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
