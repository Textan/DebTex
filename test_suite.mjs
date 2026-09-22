import { 
  runDeepResearch, 
  parseAndIndexDocument, 
  findVoiceMatch, 
  initZoomBot, 
  buildPositionDocument, 
  exportSession,
  generateLiveArgumentDraft 
} from './src/services/api.ts';

async function runAllTests() {
  console.log('====================================================');
  console.log('Debate Prep Suite — Automated End-to-End Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // ----------------------------------------------------
  // TEST 1: Feature 1 — Deep Research Engine
  // ----------------------------------------------------
  console.log('▶ TEST 1: Deep Research Engine with Freeze Date & No-Wikipedia Rule...');
  try {
    const research = await runDeepResearch({
      topic: 'Ban on Autonomous Weapons in Multilateral Warfare',
      freeze_date: '2024-01-01',
      excluded_sources: ['wikipedia.org', 'en.wikipedia.org']
    });

    if (research.angles.length < 3) {
      throw new Error(`Expected >= 3 angles, got ${research.angles.length}`);
    }
    const nicheAngle = research.angles.find(a => a.is_niche);
    if (!nicheAngle) {
      throw new Error('No niche/non-obvious angle found in results');
    }
    if (research.filtered_out_freeze_date <= 0) {
      throw new Error('Freeze date filter did not exclude post-freeze sources');
    }
    if (research.filtered_out_excluded_domains <= 0) {
      throw new Error('Excluded domain filter did not exclude Wikipedia');
    }

    console.log(`  ✓ Passed: ${research.angles.length} argument angles generated`);
    console.log(`  ✓ Niche angle identified: "${nicheAngle.title}"`);
    console.log(`  ✓ Post-freeze sources excluded: ${research.filtered_out_freeze_date}`);
    console.log(`  ✓ Disallowed domain sources excluded: ${research.filtered_out_excluded_domains}`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed Test 1:', err);
    failed++;
  }

  // ----------------------------------------------------
  // TEST 2: Feature 2 — Voice Document Search
  // ----------------------------------------------------
  console.log('\n▶ TEST 2: Voice Document Search & Section Resolution...');
  try {
    const sampleDocText = `RESOLUTION 2728 (2024)
Adopted by the Security Council at its 9586th meeting.

Section 1: Ceasefire Mandate & Hostage Release
Demands an immediate ceasefire for Ramadan leading to a lasting sustainable ceasefire.

Section 2: Humanitarian Lifeline & Border Inspection Verification
Emphasizes the urgent need to expand humanitarian assistance and establish expedited border inspection waiver mechanisms.

Section 3: Compliance Monitoring Mechanism & Secretariat Reporting
Establishes a multilateral compliance monitoring mechanism comprising regional observers to verify cessation of aerial bombardment.`;

    const doc = await parseAndIndexDocument('test-doc', 'UNSC 2728', 'txt', sampleDocText);
    if (doc.sections.length !== 4) {
      throw new Error(`Expected 4 sections, got ${doc.sections.length}`);
    }

    const match = await findVoiceMatch(doc, 'compliance monitoring mechanism');
    if (!match) {
      throw new Error('No match found for spoken query');
    }
    if (!match.section_title.toLowerCase().includes('compliance monitoring')) {
      throw new Error(`Wrong section matched: ${match.section_title}`);
    }

    console.log(`  ✓ Passed: Ingested ${doc.total_sections} sections (${doc.total_words} words)`);
    console.log(`  ✓ Spoken query 'compliance monitoring mechanism' matched: "${match.section_title}" (Score: ${match.relevance_score})`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed Test 2:', err);
    failed++;
  }

  // ----------------------------------------------------
  // TEST 3: Feature 3 — Live Debate Assistant & Retroactive Reassignment
  // ----------------------------------------------------
  console.log('\n▶ TEST 3: Live Debate Assistant, Contradiction Detection & Retroactive Reassignment...');
  try {
    const initialSegments = [
      {
        segment_id: 'seg-1',
        delegate_id: 'del-france',
        delegate_name: 'Delegate of France',
        timestamp_seconds: 15,
        timestamp_str: '00:15',
        text: 'France affirms that voluntary international codes of conduct are the pragmatic first step. Non-binding guidelines preserve sovereign trust.',
        confidence: 0.94,
        source_type: 'in_person_mic',
        is_reassigned: false
      },
      {
        segment_id: 'seg-2',
        delegate_id: 'del-china',
        delegate_name: "Delegate of China",
        timestamp_seconds: 52,
        timestamp_str: '00:52',
        text: 'China firmly rejects unilateral border screenings and insists on sovereign territorial integrity.',
        confidence: 0.91,
        source_type: 'in_person_mic',
        is_reassigned: false
      },
      {
        segment_id: 'seg-3',
        delegate_id: 'del-france',
        delegate_name: 'Delegate of France',
        timestamp_seconds: 145,
        timestamp_str: '02:25',
        text: 'France reconsiders its stance. We now demand mandatory multilateral sanctions against violators.',
        confidence: 0.89,
        source_type: 'in_person_mic',
        is_reassigned: false
      }
    ];

    const posDoc = await buildPositionDocument('UNSC 9586th Session', initialSegments);
    if (posDoc.cross_delegate_contradictions.length === 0) {
      throw new Error('Expected contradiction alert for France shifting from voluntary to mandatory');
    }
    console.log(`  ✓ Contradiction detected: "${posDoc.cross_delegate_contradictions[0].contradiction_description}"`);

    // Test Retroactive Reassignment
    console.log('  Testing retroactive reassignment of segment 1 to Delegate of India...');
    const modifiedSegments = initialSegments.map(s => {
      if (s.segment_id === 'seg-1') {
        return { ...s, delegate_id: 'del-india', delegate_name: 'Delegate of India', is_reassigned: true };
      }
      return s;
    });

    const updatedPosDoc = await buildPositionDocument('UNSC 9586th Session', modifiedSegments);
    const indiaDossier = updatedPosDoc.delegates.find(d => d.delegate_id === 'del-india');
    if (!indiaDossier) {
      throw new Error('India dossier missing after retroactive reassignment');
    }
    console.log('  Updated contradictions:', JSON.stringify(updatedPosDoc.cross_delegate_contradictions, null, 2));
    if (updatedPosDoc.cross_delegate_contradictions.length !== 0) {
      throw new Error('France contradiction should be resolved after reassignment');
    }

    console.log('  ✓ Passed: Retroactive reassignment correctly transferred segment to India dossier and updated position document!');
    passed++;
  } catch (err) {
    console.error('  ✗ Failed Test 3:', err);
    failed++;
  }

  // ----------------------------------------------------
  // TEST 4: Zoom Consent Gate & Unified Export
  // ----------------------------------------------------
  console.log('\n▶ TEST 4: Zoom Consent Gate Verification & Unified Export...');
  try {
    // Check consent enforcement
    let consentBlocked = false;
    try {
      await initZoomBot({
        meeting_id: '1234',
        user_consent_confirmed: false,
        bot_display_name: 'Test Bot',
        use_wasapi_fallback: false
      });
    } catch {
      consentBlocked = true;
    }
    if (!consentBlocked) {
      throw new Error('Zoom bot connected without consent confirmation!');
    }
    console.log('  ✓ Passed: Unmistakable consent gate blocked unauthorized connection');

    // Connect with confirmed consent
    const zoomStatus = await initZoomBot({
      meeting_id: '1234',
      user_consent_confirmed: true,
      bot_display_name: 'DebatePrep Assistant (Notetaker)',
      use_wasapi_fallback: false
    });
    if (!zoomStatus.is_connected || zoomStatus.participants_detected.length < 2) {
      throw new Error('Zoom bot failed to connect or did not detect participants');
    }
    console.log(`  ✓ Passed: Zoom Bot connected with visible name "${zoomStatus.bot_name}" and separated ${zoomStatus.participants_detected.length} participants`);

    // Verify Export
    const dummyPosDoc = await buildPositionDocument('Export Session', []);
    const exportData = await exportSession('Export Session', [], dummyPosDoc);
    if (!exportData.markdown_content.includes('Committee Position Document')) {
      throw new Error('Markdown export missing header');
    }
    console.log('  ✓ Passed: Unified Export brief generated successfully');
    passed++;
  } catch (err) {
    console.error('  ✗ Failed Test 4:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
