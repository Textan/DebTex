import React, { useState, useEffect } from 'react';
import { Key, Shield, Check, Info, Command } from 'lucide-react';
import { saveCredential, readCredential } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [braveKey, setBraveKey] = useState('');
  const [zoomClientId, setZoomClientId] = useState('');
  const [zoomClientSecret, setZoomClientSecret] = useState('');
  const [savedStatus, setSavedStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      readCredential('BraveSearch').then(setBraveKey);
      readCredential('ZoomClientID').then(setZoomClientId);
      readCredential('ZoomClientSecret').then(setZoomClientSecret);
    }
  }, [isOpen]);

  const handleSave = async () => {
    await saveCredential('BraveSearch', braveKey);
    await saveCredential('ZoomClientID', zoomClientId);
    await saveCredential('ZoomClientSecret', zoomClientSecret);
    setSavedStatus('Credentials securely updated in Windows Credential Manager!');
    setTimeout(() => setSavedStatus(null), 3000);
  };

  if (!isOpen) return null;

  return (
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
      zIndex: 1100
    }}>
      <div className="fluent-card" style={{ width: '520px', background: '#202020', border: '1px solid var(--fluent-accent)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} color="#0078D4" />
            <h2 style={{ fontSize: '15px', fontWeight: 600 }}>Windows Credential Manager & App Settings</h2>
          </div>
          <button className="fluent-btn secondary" style={{ padding: '2px 8px' }} onClick={onClose}>✕</button>
        </div>

        {/* Windows Credential Manager Notice */}
        <div style={{ background: 'rgba(0, 120, 212, 0.12)', border: '1px solid var(--fluent-accent)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '14px', fontSize: '11px', color: '#D0D0D0' }}>
          <Info size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} color="#60CDFF" />
          API credentials are saved directly into the <strong>Windows Credential Manager</strong> (`TargetName: DebatePrepSuite/*`) via DPAPI encryption and are never committed to disk in plain text.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
              Brave Search API Key:
            </label>
            <input
              id="brave-key-input"
              type="password"
              className="fluent-input"
              style={{ width: '100%', marginTop: '4px' }}
              placeholder="BSA-..."
              value={braveKey}
              onChange={e => setBraveKey(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
              Zoom App Marketplace Client ID:
            </label>
            <input
              type="text"
              className="fluent-input"
              style={{ width: '100%', marginTop: '4px' }}
              placeholder="Zoom SDK Client ID"
              value={zoomClientId}
              onChange={e => setZoomClientId(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
              Zoom App Marketplace Client Secret:
            </label>
            <input
              type="password"
              className="fluent-input"
              style={{ width: '100%', marginTop: '4px' }}
              placeholder="Zoom SDK Client Secret"
              value={zoomClientSecret}
              onChange={e => setZoomClientSecret(e.target.value)}
            />
          </div>

          {/* Keyboard Shortcuts Section */}
          <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Command size={12} /> Windows Native Keyboard Shortcuts:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <div><kbd style={{ background: '#333', padding: '1px 5px', borderRadius: '3px' }}>Ctrl + 1</kbd> Deep Research</div>
              <div><kbd style={{ background: '#333', padding: '1px 5px', borderRadius: '3px' }}>Ctrl + 2</kbd> Voice Doc Search</div>
              <div><kbd style={{ background: '#333', padding: '1px 5px', borderRadius: '3px' }}>Ctrl + 3</kbd> Live Assistant</div>
              <div><kbd style={{ background: '#333', padding: '1px 5px', borderRadius: '3px' }}>Ctrl + K</kbd> Focus Search</div>
              <div><kbd style={{ background: '#333', padding: '1px 5px', borderRadius: '3px' }}>Ctrl + E</kbd> Export Brief</div>
              <div><kbd style={{ background: '#333', padding: '1px 5px', borderRadius: '3px' }}>Ctrl + Shift + L</kbd> Toggle Mic</div>
            </div>
          </div>

          {savedStatus && (
            <div style={{ fontSize: '11px', color: '#4cd964', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Check size={12} /> {savedStatus}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
            <button className="fluent-btn secondary" onClick={onClose}>Close</button>
            <button id="save-settings-btn" className="fluent-btn" onClick={handleSave}>
              <Key size={13} /> Save to Windows Credential Manager
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
