import { DebateProject, IndexedDocument, ApprovedResearchAngle } from '../types';

// Storage Keys & DB Constants
const DB_NAME = 'DebatePrepSuiteVaultDB';
const DB_VERSION = 2;
const STORE_PROJECTS = 'debate_projects';
const STORE_META = 'vault_metadata';
const LEGACY_STORAGE_KEY = 'debate_prep_cloud_vault_v1';
const ACTIVE_PROJECT_KEY = 'debate_prep_active_project_id';

export type SyncStatus = 'synced' | 'saving' | 'offline' | 'error';

export interface StorageMetrics {
  engine: 'IndexedDB (Enterprise)' | 'Memory / LocalStorage Fallback';
  projectCount: number;
  totalDocuments: number;
  totalWords: number;
  usageBytes: number;
  quotaBytes?: number;
  usageFormatted: string;
}

type SyncListener = (status: SyncStatus) => void;
type ProjectsChangeListener = (projects: DebateProject[]) => void;

const syncListeners: Set<SyncListener> = new Set();
const changeListeners: Set<ProjectsChangeListener> = new Set();

export function onSyncStatusChange(listener: SyncListener): () => void {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

export function onVaultProjectsChange(listener: ProjectsChangeListener): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function notifySyncStatus(status: SyncStatus) {
  syncListeners.forEach(fn => {
    try { fn(status); } catch (e) { console.error(e); }
  });
}

function notifyProjectsChanged(projects: DebateProject[]) {
  changeListeners.forEach(fn => {
    try { fn(projects); } catch (e) { console.error(e); }
  });
}

// ============================================================================
// IN-MEMORY CACHE
// Enables synchronous read ergonomics (instant UI rendering with 0 hydration flicker)
// while keeping full asynchronous transactional persistence with IndexedDB / FileSystem.
// ============================================================================
let memoryProjectsCache: DebateProject[] = [];
let memoryActiveProjectId: string | null = null;
let isCacheHydrated = false;
let dbInstance: IDBDatabase | null = null;

/**
 * Initializes IndexedDB connection with version migration and creates object stores.
 */
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in current environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        const projectStore = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        projectStore.createIndex('by_updated', 'updated_at', { unique: false });
        projectStore.createIndex('by_committee', 'committee', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onerror = () => {
      console.warn('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Hydrates the in-memory cache on initial startup.
 * Checks IndexedDB first; if empty, migrates legacy localStorage data.
 */
async function hydrateMemoryCache(): Promise<void> {
  if (isCacheHydrated) return;

  // 1. Initial attempt from localStorage (for immediate sync fallback or migration)
  try {
    if (typeof localStorage !== 'undefined') {
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        memoryProjectsCache = JSON.parse(legacyRaw);
      }
      memoryActiveProjectId = localStorage.getItem(ACTIVE_PROJECT_KEY);
    }
  } catch (e) {
    console.warn('Failed reading fallback storage:', e);
  }

  // 2. Hydrate from IndexedDB if available
  try {
    const db = await openIndexedDB();
    const idbProjects = await new Promise<DebateProject[]>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    const idbActiveId = await new Promise<string | null>((resolve) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const store = tx.objectStore(STORE_META);
      const req = store.get('active_project_id');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });

    if (idbProjects.length > 0) {
      memoryProjectsCache = idbProjects.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      if (idbActiveId) memoryActiveProjectId = idbActiveId;
    } else if (memoryProjectsCache.length > 0) {
      // Migrate legacy localStorage items into IndexedDB
      await persistAllToIndexedDB(memoryProjectsCache, memoryActiveProjectId);
      console.info('Successfully migrated legacy debate projects to IndexedDB vault.');
    }
  } catch (e) {
    // Graceful fallback to localStorage cache in non-IDB environments
  }

  isCacheHydrated = true;
  notifyProjectsChanged(memoryProjectsCache);
}

// Trigger initial cache hydration immediately
if (typeof window !== 'undefined') {
  hydrateMemoryCache().catch(err => console.warn('Cache hydration error:', err));
}

/**
 * Persists an array of projects and metadata to IndexedDB transactionally.
 */
async function persistAllToIndexedDB(projects: DebateProject[], activeId: string | null): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = dbInstance || await openIndexedDB();
    const tx = db.transaction([STORE_PROJECTS, STORE_META], 'readwrite');
    const projectStore = tx.objectStore(STORE_PROJECTS);
    const metaStore = tx.objectStore(STORE_META);

    // Clear and batch re-insert
    projectStore.clear();
    for (const proj of projects) {
      projectStore.put(proj);
    }

    metaStore.put(activeId, 'active_project_id');
    metaStore.put(new Date().toISOString(), 'last_synced_at');

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('IndexedDB commit failed:', e);
    throw e;
  }
}

/**
 * Asynchronously persists a single project to IndexedDB.
 */
async function persistProjectToIndexedDB(project: DebateProject, activeId: string | null): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = dbInstance || await openIndexedDB();
    const tx = db.transaction([STORE_PROJECTS, STORE_META], 'readwrite');
    const projectStore = tx.objectStore(STORE_PROJECTS);
    const metaStore = tx.objectStore(STORE_META);

    projectStore.put(project);
    if (activeId) {
      metaStore.put(activeId, 'active_project_id');
    }
    metaStore.put(new Date().toISOString(), 'last_synced_at');

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Single project IndexedDB commit failed:', e);
  }
}

/**
 * Asynchronously deletes a project from IndexedDB.
 */
async function deleteProjectFromIndexedDB(id: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = dbInstance || await openIndexedDB();
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    const projectStore = tx.objectStore(STORE_PROJECTS);
    projectStore.delete(id);
  } catch (e) {
    console.warn('Failed to delete from IndexedDB:', e);
  }
}

/**
 * Secondary mirror to localStorage for redundancy and CLI compatibility.
 */
function mirrorToLocalStorage(projects: DebateProject[], activeId: string | null) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(projects));
    if (activeId) {
      localStorage.setItem(ACTIVE_PROJECT_KEY, activeId);
    } else {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
  } catch (e) {
    // Quota exceeded in localStorage - IndexedDB handles the true heavy payload
  }
}

// ============================================================================
// PUBLIC REPOSITORY API
// ============================================================================

/**
 * Synchronous list of all debate projects (instant UI render).
 */
export function listProjects(): DebateProject[] {
  if (!isCacheHydrated && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) memoryProjectsCache = JSON.parse(raw);
    } catch (e) { /* ignore */ }
  }
  return [...memoryProjectsCache];
}

/**
 * Retrieve a specific debate project by ID.
 */
export function getProject(id: string): DebateProject | null {
  const list = listProjects();
  return list.find(p => p.id === id) || null;
}

/**
 * Save / update a debate project with transactional persistence.
 */
export function saveProject(project: DebateProject): void {
  notifySyncStatus('saving');
  try {
    const updated: DebateProject = {
      ...project,
      updated_at: new Date().toISOString()
    };

    const idx = memoryProjectsCache.findIndex(p => p.id === project.id);
    if (idx >= 0) {
      memoryProjectsCache[idx] = updated;
    } else {
      memoryProjectsCache.unshift(updated);
    }

    memoryProjectsCache.sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    memoryActiveProjectId = project.id;

    // Secondary mirror
    mirrorToLocalStorage(memoryProjectsCache, memoryActiveProjectId);

    // Primary asynchronous IndexedDB persistence
    persistProjectToIndexedDB(updated, memoryActiveProjectId)
      .then(() => notifySyncStatus('synced'))
      .catch(() => notifySyncStatus('offline'));

    notifyProjectsChanged(memoryProjectsCache);
  } catch (err) {
    console.error('Failed to save project:', err);
    notifySyncStatus('error');
  }
}

/**
 * Delete a debate project from Cloud Vault.
 */
export function deleteProject(id: string): void {
  notifySyncStatus('saving');
  memoryProjectsCache = memoryProjectsCache.filter(p => p.id !== id);
  if (memoryActiveProjectId === id) {
    memoryActiveProjectId = memoryProjectsCache[0]?.id || null;
  }

  mirrorToLocalStorage(memoryProjectsCache, memoryActiveProjectId);
  deleteProjectFromIndexedDB(id)
    .then(() => notifySyncStatus('synced'))
    .catch(() => notifySyncStatus('offline'));

  notifyProjectsChanged(memoryProjectsCache);
}

/**
 * Clones / duplicates an existing debate project (ideal for round variations or alternate motions).
 */
export function duplicateProject(id: string): DebateProject | null {
  const original = getProject(id);
  if (!original) return null;

  const newId = `project-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const cloned: DebateProject = {
    ...JSON.parse(JSON.stringify(original)),
    id: newId,
    name: `${original.name} (Copy)`,
    created_at: now,
    updated_at: now
  };

  saveProject(cloned);
  return cloned;
}

/**
 * Get the currently active project ID.
 */
export function getActiveProjectId(): string | null {
  if (!memoryActiveProjectId && typeof localStorage !== 'undefined') {
    memoryActiveProjectId = localStorage.getItem(ACTIVE_PROJECT_KEY);
  }
  return memoryActiveProjectId;
}

/**
 * Set the currently active project ID.
 */
export function setActiveProjectId(id: string | null): void {
  memoryActiveProjectId = id;
  if (typeof localStorage !== 'undefined') {
    if (id) {
      localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
  }

  if (typeof indexedDB !== 'undefined' && dbInstance) {
    try {
      const tx = dbInstance.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put(id, 'active_project_id');
    } catch (e) { /* ignore */ }
  }
}

/**
 * Creates a brand-new blank debate project with 0 pre-filled documents or transcripts.
 */
export function createBlankProject(params: {
  name: string;
  committee: string;
  motion: string;
  freeze_date?: string;
  excluded_sources?: string[];
}): DebateProject {
  const id = `project-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newProj: DebateProject = {
    id,
    name: params.name.trim() || 'Untitled Debate',
    committee: params.committee.trim() || 'General Floor',
    motion: params.motion.trim() || 'Open Floor Debate',
    freeze_date: params.freeze_date || undefined,
    excluded_sources: params.excluded_sources || ['wikipedia.org', 'en.wikipedia.org'],
    created_at: now,
    updated_at: now,
    documents: [],
    approved_research: [],
    transcript_segments: [],
    roster: [
      { delegate_id: 'del-1', delegate_name: 'Delegate 1', country_code: 'D1', flag_emoji: '🏛️', color_accent: '#0078D4', is_speaking: false, total_speeches: 0 },
      { delegate_id: 'del-2', delegate_name: 'Delegate 2', country_code: 'D2', flag_emoji: '⚖️', color_accent: '#DE2910', is_speaking: false, total_speeches: 0 }
    ],
    position_document: undefined
  };

  saveProject(newProj);
  return newProj;
}

/**
 * Bridges approved research into the active working document and re-indexes for voice search.
 */
export function addApprovedResearchToDocument(
  project: DebateProject,
  approvedAngle: ApprovedResearchAngle
): DebateProject {
  const updatedApproved = [...project.approved_research, approvedAngle];

  let dossierDoc = project.documents.find(d => d.source_kind === 'approved_research_dossier');

  const newSectionContent = `APPROVED ARGUMENT: ${approvedAngle.title} [${approvedAngle.stance.toUpperCase()}]\n\nSummary:\n${approvedAngle.summary}\n\nFactual Claims & Citations:\n${approvedAngle.factual_claims.map(c => `- ${c.claim_text} (Source: ${c.citation.title} — ${c.citation.url})`).join('\n')}`;

  if (!dossierDoc) {
    dossierDoc = {
      document_id: `doc-research-dossier-${project.id}`,
      title: `${project.name} — Approved Research Dossier`,
      file_type: 'txt',
      total_sections: 1,
      total_words: newSectionContent.split(/\s+/).filter(Boolean).length,
      uploaded_at: new Date().toISOString(),
      source_kind: 'approved_research_dossier',
      sections: [
        {
          section_id: `sec-approved-0`,
          index: 0,
          title: approvedAngle.title,
          content: newSectionContent,
          page_number: 1,
          word_count: newSectionContent.split(/\s+/).filter(Boolean).length,
          keywords: [approvedAngle.stance.toLowerCase(), 'approved', 'research', ...approvedAngle.title.toLowerCase().split(/\s+/).filter(w => w.length > 3)]
        }
      ]
    };
  } else {
    const nextIdx = dossierDoc.sections.length;
    const newSection = {
      section_id: `sec-approved-${nextIdx}`,
      index: nextIdx,
      title: approvedAngle.title,
      content: newSectionContent,
      page_number: Math.floor(nextIdx / 2) + 1,
      word_count: newSectionContent.split(/\s+/).filter(Boolean).length,
      keywords: [approvedAngle.stance.toLowerCase(), 'approved', 'research', ...approvedAngle.title.toLowerCase().split(/\s+/).filter(w => w.length > 3)]
    };
    dossierDoc = {
      ...dossierDoc,
      sections: [...dossierDoc.sections, newSection],
      total_sections: dossierDoc.sections.length + 1,
      total_words: dossierDoc.total_words + newSection.word_count
    };
  }

  const otherDocs = project.documents.filter(d => d.document_id !== dossierDoc!.document_id);
  const updatedDocs = [dossierDoc, ...otherDocs];

  const updatedProject: DebateProject = {
    ...project,
    approved_research: updatedApproved,
    documents: updatedDocs,
    active_document_id: dossierDoc.document_id
  };

  saveProject(updatedProject);
  return updatedProject;
}

// ============================================================================
// METRICS, EXPORT & IMPORT
// ============================================================================

/**
 * Calculates live storage usage, quota, and database engine type.
 */
export async function getStorageMetrics(): Promise<StorageMetrics> {
  const projects = listProjects();
  let totalDocs = 0;
  let totalWords = 0;

  for (const p of projects) {
    totalDocs += p.documents?.length || 0;
    for (const doc of p.documents || []) {
      totalWords += doc.total_words || 0;
    }
  }

  let usageBytes = 0;
  let quotaBytes: number | undefined;
  const isIndexedDB = typeof indexedDB !== 'undefined';

  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      usageBytes = estimate.usage || 0;
      quotaBytes = estimate.quota;
    } catch (e) {
      usageBytes = JSON.stringify(projects).length * 2;
    }
  } else {
    usageBytes = JSON.stringify(projects).length * 2;
  }

  const usageFormatted = usageBytes > 1024 * 1024 
    ? `${(usageBytes / (1024 * 1024)).toFixed(2)} MB`
    : `${Math.max(1, Math.round(usageBytes / 1024))} KB`;

  return {
    engine: isIndexedDB ? 'IndexedDB (Enterprise)' : 'Memory / LocalStorage Fallback',
    projectCount: projects.length,
    totalDocuments: totalDocs,
    totalWords,
    usageBytes,
    quotaBytes,
    usageFormatted
  };
}

/**
 * Exports the entire Cloud Vault to a versioned JSON backup package.
 */
export function exportVaultToJson(): string {
  const list = listProjects();
  const payload = {
    schema_version: '2.0',
    app: 'Debate Prep Suite',
    exported_at: new Date().toISOString(),
    project_count: list.length,
    projects: list
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Imports a JSON backup file, performs integrity verification, and rehydrates the store.
 */
export function importVaultFromJson(jsonStr: string): boolean {
  try {
    const parsed = JSON.parse(jsonStr);
    let importedProjects: DebateProject[] = [];

    // Support schema 2.0 wrapper as well as direct legacy array
    if (parsed && Array.isArray(parsed.projects)) {
      importedProjects = parsed.projects;
    } else if (Array.isArray(parsed)) {
      importedProjects = parsed;
    } else {
      return false;
    }

    if (importedProjects.length === 0) return false;

    // Merge or replace
    const existingMap = new Map(memoryProjectsCache.map(p => [p.id, p]));
    for (const proj of importedProjects) {
      if (proj.id && proj.name) {
        existingMap.set(proj.id, proj);
      }
    }

    memoryProjectsCache = Array.from(existingMap.values()).sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    if (!memoryActiveProjectId && memoryProjectsCache.length > 0) {
      memoryActiveProjectId = memoryProjectsCache[0].id;
    }

    mirrorToLocalStorage(memoryProjectsCache, memoryActiveProjectId);
    persistAllToIndexedDB(memoryProjectsCache, memoryActiveProjectId)
      .then(() => notifySyncStatus('synced'))
      .catch(() => notifySyncStatus('offline'));

    notifyProjectsChanged(memoryProjectsCache);
    return true;
  } catch (err) {
    console.error('Invalid vault JSON payload:', err);
    return false;
  }
}
