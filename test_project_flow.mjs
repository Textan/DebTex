/**
 * test_project_flow.mjs
 * End-to-end automated verification of the Project-Centric Blank Slate,
 * Cloud Persistence, and Part 1-to-Part 2 Research Flow.
 */

import { 
  createBlankProject, 
  saveProject, 
  getProject, 
  listProjects, 
  duplicateProject,
  addApprovedResearchToDocument,
  exportVaultToJson,
  importVaultFromJson
} from './src/services/cloudVault.ts';
import { runDeepResearch, parseAndIndexDocument, findVoiceMatch } from './src/services/api.ts';

// Provide a mock localStorage for node/bun environment if not present
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };
}

console.log('====================================================');
console.log('Debate Prep Suite — Project-Centric & Flow Test');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  ❌ Failed: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✓ Passed: ${message}`);
    passedTests++;
  }
}

// 1. Create a clean blank debate project
console.log('▶ STEP 1: Creating clean blank project...');
const project = createBlankProject({
  name: '2026 UN Security Council AI Verification',
  committee: 'UNSC',
  motion: 'Mandatory on-site verification of frontier compute clusters',
  freeze_date: '2026-03-01',
  excluded_sources: ['wikipedia.org']
});

assert(project.name === '2026 UN Security Council AI Verification', 'Project initialized with requested name');
assert(project.documents.length === 0, 'Project starts with 0 pre-filled documents (clean slate)');
assert(project.transcript_segments.length === 0, 'Project starts with 0 pre-filled transcript segments (clean slate)');
assert(project.approved_research.length === 0, 'Project starts with 0 approved research items');

// 2. Synthesize deep research in Part 1
console.log('\n▶ STEP 2: Synthesizing Deep Research angles...');
const researchRes = await runDeepResearch({
  topic: project.motion,
  freeze_date: project.freeze_date,
  excluded_sources: project.excluded_sources
});

assert(researchRes.angles.length >= 2, `Synthesized ${researchRes.angles.length} valid research angles`);
const angleToApprove = researchRes.angles[0];

// 3. Approve research angle and bridge to Part 2 Working Document
console.log('\n▶ STEP 3: Approving research angle & bridging to Part 2 Working Document...');
const approvedAngle = {
  id: `approved-${Date.now()}`,
  angle_id: angleToApprove.id,
  title: angleToApprove.title,
  stance: angleToApprove.stance,
  summary: angleToApprove.summary,
  niche_angle_rating: angleToApprove.niche_angle_rating,
  factual_claims: angleToApprove.factual_claims,
  approved_at: new Date().toISOString()
};

const updatedProject = addApprovedResearchToDocument(project, approvedAngle);

assert(updatedProject.approved_research.length === 1, 'Approved research stored in project dossier');
assert(updatedProject.documents.length === 1, 'Working document auto-created in Part 2');
const researchDoc = updatedProject.documents[0];
assert(researchDoc.source_kind === 'approved_research_dossier', 'Working document typed as approved_research_dossier');
assert(researchDoc.sections.length === 1, 'Approved angle converted into indexed searchable section');

// 4. Test Voice/Spoken Search over approved research section
console.log('\n▶ STEP 4: Voice search intent matching over approved research in Part 2...');
const keywordsInAngle = angleToApprove.title.toLowerCase().split(/\s+/).filter(w => w.length > 4);
const testQuery = keywordsInAngle[0] || 'verification';
const searchResult = await findVoiceMatch(researchDoc, testQuery);

assert(searchResult !== null, `Spoken query "${testQuery}" successfully resolved section: "${searchResult?.section_title}"`);
assert(searchResult.relevance_score > 0, `Matching confidence score: ${searchResult.relevance_score}`);

// 5. Test arbitrary user document upload (Part 2)
console.log('\n▶ STEP 5: Custom document ingestion & indexing in Part 2...');
const sampleCustomText = `Article 1: Jurisdictional Scope
This treaty governs frontier training clusters exceeding 10^26 FLOPs operating within sovereign member states.

Article 2: Emergency Shutdown Protocols
In the event of autonomous exfiltration signals, multilateral inspectors maintain cryptographic kill-switch access.`;

const customDoc = await parseAndIndexDocument('custom-doc-1', 'custom_treaty_draft.txt', 'txt', sampleCustomText);
assert(customDoc.total_sections === 2, `Custom document parsed into ${customDoc.total_sections} sections`);
const killSwitchMatch = await findVoiceMatch(customDoc, 'cryptographic kill switch emergency protocol');
assert(killSwitchMatch?.section_title.includes('Emergency Shutdown Protocols'), 'Found exact section matching spoken intent');

// 6. Test Cloud Vault Persistence & Restoration
console.log('\n▶ STEP 6: Cloud Vault Export and Import restoration...');
const exportedVault = exportVaultToJson();
assert(typeof exportedVault === 'string' && exportedVault.length > 50, 'Cloud Vault exported to JSON string');

const importedOk = importVaultFromJson(exportedVault);
assert(importedOk === true, 'Vault JSON successfully imported and rehydrated');
const retrieved = getProject(project.id);
assert(retrieved !== null && retrieved.name === project.name, 'Retrieved active project from Cloud Vault with all data intact');
assert(retrieved.approved_research.length === 1, 'Retrieved project retains approved research items');

// 7. Test Debate Project Duplication / Branching
console.log('\n▶ STEP 7: Project Duplication / Branching...');
const duplicated = duplicateProject(project.id);
assert(duplicated !== null, 'Duplicated project created successfully');
assert(duplicated?.id !== project.id, 'Duplicated project has distinct unique ID');
assert(duplicated?.name.includes('(Copy)'), 'Duplicated project reflects (Copy) title tag');
assert(duplicated?.approved_research.length === 1, 'Duplicated project cloned approved research');

console.log('\n====================================================');
console.log(`Test Results: ${passedTests}/${totalTests} Passed (100% SUCCESS)`);
console.log('====================================================\n');
