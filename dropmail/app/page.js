'use client';

import { useMemo, useState } from 'react';

const STATUSES = ['Found', 'Researching', 'Prototype', 'Test print', 'Listed', 'Rejected'];
const REJECT_REASONS = ['Too hard to print', 'Too much competition', 'Not enough demand', 'Safety risk', 'Too cheap'];

const defaultTasks = [
  'Search Etsy / Amazon',
  'Search AliExpress',
  'Search Thingiverse / Printables',
  'Check Facebook Marketplace',
  'Can print under 2 hours',
  'Measure real part',
];

const sampleText = `I need something to hold my charger cable because it always falls behind my desk.
Does anyone know where I can buy replacement wheels for an old dishwasher rack?
I hate when the shower hose scratches the wall. Looking for a small clip or holder.
Any solution for cabinet shelves that keep sagging in the middle?`;

const starterIdeas = [
  {
    id: 1,
    title: 'Dishwasher Rack Wheel Replacement',
    category: 'Kitchen Repair Part',
    image: 'DW',
    source: 'Example Scan',
    demand: 'High',
    score: 91,
    confidence: 'High',
    triggerPhrase: 'where can I buy',
    problemQuote: 'Where can I buy replacement wheels for an old dishwasher rack?',
    customerProblem: 'Dishwasher rack wheels break, disappear, or become expensive to replace.',
    printableSolution: 'A clip-on wheel or roller set sized for common dishwasher racks.',
    priceRange: '250-700 MKD',
    printCost: '30-90 MKD',
    weight: '20-60g',
    size: '2cm x 2cm each',
    market: 'Home repair / appliance owners',
    difficulty: 'Medium',
    profitPotential: 'High',
    material: 'PETG',
    riskLevel: 'Medium',
    riskReason: 'Needs heat and water resistance, plus correct fit.',
    printTime: '45-90 min',
    competition: 'Medium',
    repeatBuyers: 'Low',
    reason: 'Replacement parts are small, practical, and buyers search for them when something is already broken.',
    keywords: ['dishwasher rack wheel', 'dishwasher roller', 'rack replacement part'],
    scoreBreakdown: { demand: 92, printDifficulty: 65, profit: 84, competition: 58, shipping: 90, repeatBuyers: 35 },
    validationTasks: defaultTasks,
    checkedTasks: [],
    prototypeSteps: ['Measure axle diameter', 'Model wheel and clip fit', 'Print PETG test piece', 'Test inside warm water cycle'],
    measurementsNeeded: ['Axle diameter', 'Wheel width', 'Rack wire diameter', 'Clearance under rack'],
    cadBrief: 'Create a small dishwasher rack roller with a snap-on clip. Use rounded edges, PETG-friendly tolerances, and printable orientation without supports.',
    listingTitle: 'Dishwasher Rack Replacement Wheel Set',
    listingDescription: 'Small replacement wheels for old dishwasher racks. Useful when original rollers break or become hard to find.',
    status: 'Found',
    rejectReason: '',
    notes: '',
    conceptPrompt: '',
    conceptImage: '',
    imageUrl: '',
    evidenceCount: 2,
    mergedPhrases: ['where can I buy', 'need a replacement'],
  },
  {
    id: 2,
    title: 'Desk Cable Catcher Clip',
    category: 'Desk Organizer',
    image: 'CC',
    source: 'Example Scan',
    demand: 'High',
    score: 86,
    confidence: 'High',
    triggerPhrase: 'I need',
    problemQuote: 'I need something to hold my charger cable because it always falls behind my desk.',
    customerProblem: 'Charging cables fall behind desks and are annoying to reach every day.',
    printableSolution: 'A stick-on or clamp-on cable catcher that holds one to three cables.',
    priceRange: '150-350 MKD',
    printCost: '15-45 MKD',
    weight: '10-35g',
    size: '4cm x 3cm',
    market: 'Students, offices, gamers',
    difficulty: 'Easy',
    profitPotential: 'Medium',
    material: 'PLA',
    riskLevel: 'Low',
    riskReason: 'Simple non-load-bearing desk accessory.',
    printTime: '20-45 min',
    competition: 'High',
    repeatBuyers: 'Medium',
    reason: 'Simple print, low material cost, easy to bundle in multiple colors.',
    keywords: ['desk cable clip', 'charger holder', 'cable catcher'],
    scoreBreakdown: { demand: 84, printDifficulty: 94, profit: 72, competition: 45, shipping: 95, repeatBuyers: 62 },
    validationTasks: defaultTasks,
    checkedTasks: [],
    prototypeSteps: ['Choose cable diameter range', 'Model adhesive flat back', 'Print 3 sizes', 'Test with USB-C and laptop chargers'],
    measurementsNeeded: ['Cable diameters', 'Desk edge thickness', 'Adhesive pad size'],
    cadBrief: 'Design a compact cable catcher with a flat adhesive back and flexible cable slot. Make 1, 2, and 3 cable versions.',
    listingTitle: 'Desk Cable Catcher Clip',
    listingDescription: 'Keeps charger cables from falling behind your desk. Available in simple colors and bundle packs.',
    status: 'Found',
    rejectReason: '',
    notes: '',
    conceptPrompt: '',
    conceptImage: '',
    imageUrl: '',
    evidenceCount: 1,
    mergedPhrases: ['I need'],
  },
  {
    id: 3,
    title: 'Shower Hose Wall Guard',
    category: 'Bathroom Part',
    image: 'SH',
    source: 'Example Scan',
    demand: 'Medium',
    score: 78,
    confidence: 'Medium',
    triggerPhrase: 'I hate when',
    problemQuote: 'I hate when the shower hose scratches the wall. Looking for a small clip or holder.',
    customerProblem: 'Metal shower hoses scrape tiles or painted walls.',
    printableSolution: 'A rounded wall guard or adhesive hose guide that keeps the hose away from the surface.',
    priceRange: '150-450 MKD',
    printCost: '20-60 MKD',
    weight: '20-55g',
    size: '6cm x 5cm',
    market: 'Bathroom accessories',
    difficulty: 'Easy',
    profitPotential: 'Medium',
    material: 'PETG',
    riskLevel: 'Low',
    riskReason: 'Bathroom humidity means PETG is safer than PLA.',
    printTime: '45-75 min',
    competition: 'Medium',
    repeatBuyers: 'Low',
    reason: 'Bathroom problems are common, visible, and easy to understand from a product photo.',
    keywords: ['shower hose holder', 'wall guard', 'bathroom clip'],
    scoreBreakdown: { demand: 76, printDifficulty: 88, profit: 68, competition: 61, shipping: 92, repeatBuyers: 28 },
    validationTasks: defaultTasks,
    checkedTasks: [],
    prototypeSteps: ['Measure shower hose diameter', 'Model rounded guide', 'Print PETG prototype', 'Test adhesive position'],
    measurementsNeeded: ['Hose diameter', 'Tile clearance', 'Adhesive pad area'],
    cadBrief: 'Design a rounded shower hose guide with no sharp edges and a flat adhesive mounting area.',
    listingTitle: 'Shower Hose Wall Guard',
    listingDescription: 'A small bathroom guide that keeps shower hoses from scratching walls or tiles.',
    status: 'Found',
    rejectReason: '',
    notes: '',
    conceptPrompt: '',
    conceptImage: '',
    imageUrl: '',
    evidenceCount: 1,
    mergedPhrases: ['I hate when'],
  },
];

function demandLabel(score) {
  if (score >= 80) return 'High';
  if (score >= 55) return 'Medium';
  return 'Low';
}

function normalizeBreakdown(raw = {}, fallbackScore) {
  return {
    demand: Number(raw.demand || fallbackScore || 50),
    printDifficulty: Number(raw.print_difficulty || raw.printDifficulty || 50),
    profit: Number(raw.profit || 50),
    competition: Number(raw.competition || 50),
    shipping: Number(raw.shipping || 50),
    repeatBuyers: Number(raw.repeat_buyers || raw.repeatBuyers || 50),
  };
}

function opportunityKey(idea) {
  const text = [
    idea.title,
    idea.product_name,
    idea.category,
    ...(idea.keywords || idea.validation_keywords || []),
  ]
    .join(' ')
    .toLowerCase()
    .replace(/replacement|holder|clip|mount|adapter|organizer|part|for|the|and|with/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ');

  return text
    .split(' ')
    .filter((word) => word.length > 3)
    .slice(0, 5)
    .sort()
    .join('-');
}

function mergeIdeas(rawIdeas) {
  const groups = new Map();

  rawIdeas.forEach((idea) => {
    const key = opportunityKey(idea) || `${idea.category}-${idea.title}`;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        ...idea,
        evidenceCount: Number(idea.evidenceCount || idea.evidence_count || 1),
        mergedPhrases: [
          idea.problemQuote,
          idea.triggerPhrase,
          ...(idea.mergedPhrases || idea.merged_phrases || []),
        ].filter(Boolean),
        keywords: [...new Set(idea.keywords || [])],
      });
      return;
    }

    const evidenceCount = existing.evidenceCount + Number(idea.evidenceCount || idea.evidence_count || 1);
    const bestScoreIdea = Number(idea.score || 0) > Number(existing.score || 0) ? idea : existing;

    groups.set(key, {
      ...existing,
      ...bestScoreIdea,
      evidenceCount,
      score: Math.min(100, Math.max(existing.score || 0, idea.score || 0) + Math.min(12, (evidenceCount - 1) * 4)),
      demand: demandLabel(Math.min(100, Math.max(existing.score || 0, idea.score || 0) + Math.min(12, (evidenceCount - 1) * 4))),
      mergedPhrases: [
        ...(existing.mergedPhrases || []),
        idea.problemQuote,
        idea.triggerPhrase,
        ...(idea.mergedPhrases || []),
      ].filter(Boolean).slice(0, 8),
      keywords: [...new Set([...(existing.keywords || []), ...(idea.keywords || [])])],
      reason: `${bestScoreIdea.reason} Repeated demand signals: ${evidenceCount}.`,
    });
  });

  return [...groups.values()].sort((a, b) => {
    const scoreA = Number(a.score || 0) + Number(a.evidenceCount || 1) * 2;
    const scoreB = Number(b.score || 0) + Number(b.evidenceCount || 1) * 2;
    return scoreB - scoreA;
  });
}

function chunkText(input, maxChars = 6000) {
  const lines = input
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const chunks = [];
  let current = '';

  lines.forEach((line) => {
    if ((current + '\n' + line).length > maxChars && current) {
      chunks.push(current);
      current = line;
      return;
    }
    current = current ? `${current}\n${line}` : line;
  });

  if (current) chunks.push(current);
  return chunks.length ? chunks : [input];
}

function normalizeIdea(idea, index, source) {
  const score = Number(idea.demand_score || idea.score || 50);
  return {
    id: `${Date.now()}-${index}`,
    title: idea.product_name || idea.title || 'Untitled Product Idea',
    category: idea.category || '3D Printable Part',
    image: (idea.product_name || 'AI').slice(0, 2).toUpperCase(),
    source,
    demand: demandLabel(score),
    score,
    confidence: idea.confidence || 'Medium',
    triggerPhrase: idea.trigger_phrase || 'Detected demand',
    problemQuote: idea.problem_quote || '',
    customerProblem: idea.customer_problem || '',
    printableSolution: idea.printable_solution || '',
    priceRange: idea.expected_price_mkd || 'Estimate needed',
    printCost: idea.estimated_print_cost_mkd || 'Estimate needed',
    weight: idea.estimated_weight || 'Estimate needed',
    size: idea.estimated_size || 'Estimate needed',
    market: idea.market || 'Local + online',
    difficulty: idea.difficulty || 'Medium',
    profitPotential: idea.profit_potential || 'Medium',
    material: idea.material || 'PLA/PETG',
    riskLevel: idea.risk_level || 'Medium',
    riskReason: idea.risk_reason || 'Needs real-world fit testing.',
    printTime: idea.print_time_estimate || 'Estimate needed',
    competition: idea.competition_level || 'Unknown',
    repeatBuyers: idea.repeat_buyer_potential || 'Unknown',
    reason: idea.why_it_can_sell || idea.reasoning || 'AI detected possible demand for a printable product.',
    keywords: Array.isArray(idea.validation_keywords) ? idea.validation_keywords : [],
    scoreBreakdown: normalizeBreakdown(idea.score_breakdown, score),
    validationTasks: Array.isArray(idea.validation_tasks) && idea.validation_tasks.length ? idea.validation_tasks : defaultTasks,
    checkedTasks: [],
    prototypeSteps: Array.isArray(idea.prototype_steps) ? idea.prototype_steps : [],
    measurementsNeeded: Array.isArray(idea.measurements_needed) ? idea.measurements_needed : [],
    cadBrief: idea.cad_brief || '',
    listingTitle: idea.listing_title || idea.product_name || '',
    listingDescription: idea.listing_description || '',
    status: idea.status || 'Found',
    rejectReason: '',
    notes: '',
    conceptPrompt: idea.concept_prompt || '',
    conceptImage: '',
    imageUrl: idea.image_url || '',
    evidenceCount: Number(idea.evidence_count || 1),
    mergedPhrases: Array.isArray(idea.merged_phrases) ? idea.merged_phrases : [],
  };
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function researchQuery(idea) {
  return encodeURIComponent([idea.title, ...(idea.keywords || [])].join(' '));
}

function imageQuery(idea) {
  return encodeURIComponent(
    [idea.title, idea.category, ...(idea.keywords || [])]
      .join(' ')
      .replace(/replacement|3d printed|printable/gi, '')
      .trim()
  );
}

function visualLabel(idea) {
  const words = String(idea.title || 'Idea')
    .split(/\s+/)
    .filter((word) => word.length > 2);
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

function visualAccent(idea) {
  const category = `${idea.category} ${idea.title}`.toLowerCase();
  if (category.includes('kitchen') || category.includes('dishwasher')) return '#0f766e';
  if (category.includes('bathroom') || category.includes('shower')) return '#2563eb';
  if (category.includes('desk') || category.includes('cable')) return '#7c3aed';
  if (category.includes('car')) return '#dc2626';
  return '#15803d';
}

function listingText(idea) {
  return [
    idea.listingTitle || idea.title,
    '',
    idea.listingDescription || idea.reason,
    '',
    `Price: ${idea.priceRange}`,
    `Material: ${idea.material}`,
    `Keywords: ${(idea.keywords || []).join(', ')}`,
  ].join('\n');
}

function ideaFingerprint(idea) {
  return String(idea.title || (idea.keywords || []).slice(0, 2).join(' '))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word.length > 3)
    .slice(0, 4)
    .join(' ');
}

export default function Home() {
  const [text, setText] = useState(sampleText);
  const [source, setSource] = useState('Reddit / comments');
  const [niche, setNiche] = useState('Home, kitchen, bathroom, machines');
  const [ideas, setIdeas] = useState(starterIdeas);
  const [selectedId, setSelectedId] = useState(starterIdeas[0].id);
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [saveAllLoading, setSaveAllLoading] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [conceptLoading, setConceptLoading] = useState(false);
  const [activeView, setActiveView] = useState('finder');
  const [statusFilter, setStatusFilter] = useState('All');
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [materialFilter, setMaterialFilter] = useState('All');
  const [minScoreFilter, setMinScoreFilter] = useState('0');
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [summary, setSummary] = useState('Paste comments or posts, then scan them for real buying intent.');
  const [error, setError] = useState('');

  const selected = ideas.find((idea) => idea.id === selectedId) || ideas[0] || null;
  const duplicateCounts = useMemo(() => {
    const counts = new Map();
    ideas.forEach((idea) => {
      const key = ideaFingerprint(idea);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [ideas]);
  const categoryOptions = useMemo(() => ['All', ...new Set(ideas.map((idea) => idea.category).filter(Boolean))], [ideas]);
  const materialOptions = useMemo(() => ['All', ...new Set(ideas.map((idea) => idea.material).filter(Boolean))], [ideas]);
  const visibleIdeas = useMemo(() => {
    const query = catalogueSearch.trim().toLowerCase();
    return ideas.filter((idea) => {
      const duplicateCount = duplicateCounts.get(ideaFingerprint(idea)) || 0;
      const haystack = [idea.title, idea.category, idea.material, idea.status, idea.notes, ...(idea.keywords || [])].join(' ').toLowerCase();
      return (
        (statusFilter === 'All' || idea.status === statusFilter) &&
        (categoryFilter === 'All' || idea.category === categoryFilter) &&
        (materialFilter === 'All' || idea.material === materialFilter) &&
        Number(idea.score || 0) >= Number(minScoreFilter || 0) &&
        (!query || haystack.includes(query)) &&
        (!duplicatesOnly || duplicateCount > 1)
      );
    });
  }, [ideas, statusFilter, categoryFilter, materialFilter, minScoreFilter, catalogueSearch, duplicatesOnly, duplicateCounts]);

  const stats = useMemo(() => {
    const high = ideas.filter((idea) => idea.score >= 80).length;
    const easy = ideas.filter((idea) => idea.difficulty === 'Easy').length;
    const avg = ideas.length ? Math.round(ideas.reduce((total, idea) => total + Number(idea.score || 0), 0) / ideas.length) : 0;
    return { high, easy, avg };
  }, [ideas]);

  function updateIdea(id, patch) {
    setIdeas((current) => current.map((idea) => (idea.id === id ? { ...idea, ...patch } : idea)));
  }

  function toggleTask(task) {
    if (!selected) return;
    const checked = selected.checkedTasks || [];
    const next = checked.includes(task) ? checked.filter((item) => item !== task) : [...checked, task];
    updateIdea(selected.id, { checkedTasks: next });
  }

  function exportCsv() {
    const rows = [
      ['product name', 'score', 'price', 'print cost', 'material', 'status', 'reject reason', 'notes'],
      ...ideas.map((idea) => [
        idea.title,
        idea.score,
        idea.priceRange,
        idea.printCost,
        idea.material,
        idea.status,
        idea.rejectReason,
        idea.notes,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'printtrend-ideas.csv';
    link.click();
    URL.revokeObjectURL(url);
    setSummary('Exported ideas to CSV.');
  }

  async function copyListing() {
    if (!selected) return;
    await navigator.clipboard.writeText(listingText(selected));
    setSummary(`Copied listing for "${selected.title}".`);
  }

  async function analyzeDemand() {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    setSummary('Scanning for demand phrases and printable product ideas...');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, source, niche }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Analysis failed');

      const rawIdeas = (json.data?.ideas || []).map((idea, index) => normalizeIdea(idea, index, source));
      const newIdeas = mergeIdeas(rawIdeas);
      const mergedAway = Math.max(0, rawIdeas.length - newIdeas.length);
      setSummary(
        json.data?.fallback
          ? `${json.data.summary} (${newIdeas.length} draft ideas)`
          : json.data?.summary ||
          (newIdeas.length
            ? `Found ${newIdeas.length} ranked opportunities${mergedAway ? ` after merging ${mergedAway} duplicate signals` : ''}.`
            : 'No strong 3D-printable demand found in this text.')
      );

      if (newIdeas.length) {
        setIdeas(newIdeas);
        setSelectedId(newIdeas[0].id);
        setActiveView('finder');
        setStatusFilter('All');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not analyze this text.');
      setSummary('The scan did not complete. Check the API key and try again.');
    }

    setLoading(false);
  }

  async function scanChunk(chunk, chunkIndex = 0) {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: chunk,
        source: `${source} batch ${chunkIndex + 1}`,
        niche,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Analysis failed');
    const ideas = (json.data?.ideas || []).map((idea, index) =>
      normalizeIdea(idea, `${chunkIndex}-${index}`, source)
    );
    return { ideas, fallback: Boolean(json.data?.fallback) };
  }

  async function bulkScan() {
    if (!text.trim()) return;

    const chunks = chunkText(text);
    setBulkLoading(true);
    setError('');
    setSummary(`Bulk scanning ${chunks.length} text chunk${chunks.length === 1 ? '' : 's'}...`);

    try {
      const scannedIdeas = [];

      for (let index = 0; index < chunks.length; index += 1) {
        setSummary(`Scanning batch ${index + 1} of ${chunks.length}...`);
        const chunkResult = await scanChunk(chunks[index], index);
        scannedIdeas.push(...chunkResult.ideas);
      }

      const merged = mergeIdeas(scannedIdeas);
      setIdeas(merged);
      setSelectedId(merged[0]?.id || null);
      setActiveView('finder');
      setStatusFilter('All');
      setSummary(`Bulk scan found ${merged.length} ranked opportunities from ${scannedIdeas.length} raw signals.`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Bulk scan failed.');
      setSummary('Bulk scan did not complete.');
    }

    setBulkLoading(false);
  }

  async function saveAllIdeas() {
    if (!ideas.length) return;
    setSaveAllLoading(true);
    setError('');

    try {
      const res = await fetch('/api/save-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideas }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Bulk save failed');
      setSummary(`Saved ${json.count} ideas to the catalogue.`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Bulk save failed.');
    }

    setSaveAllLoading(false);
  }

  async function generateBrief() {
    if (!selected) return;
    setBriefLoading(true);
    setError('');

    try {
      const res = await fetch('/api/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: selected }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not generate brief');

      updateIdea(selected.id, {
        cadBrief: json.data.cad_brief || selected.cadBrief,
        prototypeSteps: json.data.prototype_steps || selected.prototypeSteps,
        measurementsNeeded: json.data.measurements_needed || selected.measurementsNeeded,
        material: json.data.material || selected.material,
        riskLevel: json.data.risk_level || selected.riskLevel,
        riskReason: json.data.risk_reason || selected.riskReason,
        listingTitle: json.data.listing_title || selected.listingTitle,
        listingDescription: json.data.listing_description || selected.listingDescription,
        printSettings: json.data.print_settings || selected.printSettings,
        firstTestPlan: json.data.first_test_plan || selected.firstTestPlan,
      });
      setSummary(`Prototype brief updated for "${selected.title}".`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Prototype brief failed.');
    }

    setBriefLoading(false);
  }

  async function generateConcept() {
    if (!selected) return;
    setConceptLoading(true);
    setError('');

    try {
      const res = await fetch('/api/concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: selected }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not generate concept');

      updateIdea(selected.id, {
        conceptPrompt: json.data.prompt || selected.conceptPrompt,
        conceptImage: json.data.image || selected.conceptImage,
      });
      setSummary(`Concept generated for "${selected.title}".`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Concept generation failed.');
    }

    setConceptLoading(false);
  }

  async function loadSavedIdeas(nextView = 'saved') {
    setError('');
    try {
      const res = await fetch('/api/saved');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Could not load saved ideas');

      const savedIdeas = json.data.map((item) => ({
        ...(item.raw_data || {}),
        id: item.id,
        title: item.title,
        category: item.category,
        demand: item.demand,
        score: item.score,
        priceRange: item.price_range,
        printCost: item.print_cost,
        weight: item.weight,
        size: item.size,
        market: item.market,
        difficulty: item.difficulty,
        reason: item.reason,
        material: item.raw_data?.material || 'Unknown',
        status: item.raw_data?.status || item.raw_data?.workflow?.status || 'Found',
        rejectReason: item.raw_data?.rejectReason || item.raw_data?.workflow?.reject_reason || '',
        notes: item.raw_data?.notes || item.raw_data?.workflow?.notes || '',
        checkedTasks: item.raw_data?.checkedTasks || item.raw_data?.workflow?.checked_tasks || [],
      }));

      setIdeas(savedIdeas);
      setSelectedId(savedIdeas[0]?.id || null);
      setSummary(savedIdeas.length ? `Loaded ${savedIdeas.length} saved opportunities.` : 'No saved ideas yet.');
      setActiveView(nextView);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error loading saved ideas');
    }
  }

  async function openCatalogue() {
    await loadSavedIdeas('catalogue');
  }

  async function saveIdea() {
    if (!selected) return;
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selected),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Error saving');
      setSummary(`Saved "${selected.title}" to your idea list.`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error saving');
    }
  }

  return (
    <main style={styles.app}>
      <aside style={styles.sidebar}>
        <div style={styles.logoMark}>PT</div>
        <div style={styles.logoText}>PrintTrend</div>
        <div style={styles.menuTitle}>Market Intelligence</div>
        <NavButton active={activeView === 'finder'} onClick={() => setActiveView('finder')}>Idea Finder</NavButton>
        <NavButton active={activeView === 'saved'} onClick={loadSavedIdeas}>Saved Ideas</NavButton>
        <NavButton active={activeView === 'catalogue'} onClick={openCatalogue}>Catalogue</NavButton>
        <NavButton active={activeView === 'sources'} onClick={() => setActiveView('sources')}>Sources</NavButton>
        <NavButton active={activeView === 'scores'} onClick={() => setActiveView('scores')}>Demand Scores</NavButton>
        <div style={styles.sidebarBox}><strong>{ideas.length}</strong><span> ideas found</span></div>
      </aside>

      <section style={styles.content}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>3D Product Idea Finder</h1>
            <p style={styles.subtitle}>Scan comments, validate ideas, and move the best ones to prototype.</p>
          </div>
          <div style={styles.privateMode}>AI workbench</div>
        </header>

        <section style={styles.scanPanel}>
          <div style={styles.scanHeader}>
            <div>
              <h2 style={styles.scanTitle}>Scan Demand</h2>
              <p style={styles.scanHint}>Paste complaints, repair questions, reviews, or buying posts.</p>
            </div>
            <div style={styles.scanStats}>
              <Metric label="Avg score" value={`${stats.avg}/100`} />
              <Metric label="High" value={stats.high} />
              <Metric label="Easy" value={stats.easy} />
            </div>
          </div>
          <div style={styles.inputRow}>
            <label style={styles.label}>Source<input style={styles.input} value={source} onChange={(e) => setSource(e.target.value)} /></label>
            <label style={styles.label}>Niche<input style={styles.input} value={niche} onChange={(e) => setNiche(e.target.value)} /></label>
          </div>
          <textarea style={styles.textarea} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste comments, posts, reviews, or forum threads here..." />
          <div style={styles.actionRow}>
            <button style={styles.button} onClick={analyzeDemand} disabled={loading}>{loading ? 'Scanning...' : 'Scan Demand'}</button>
            <button style={styles.buttonAlt} onClick={bulkScan} disabled={bulkLoading}>{bulkLoading ? 'Bulk scanning...' : 'Bulk Scan'}</button>
            <button style={styles.secondaryButton} onClick={() => setText(sampleText)}>Load Example</button>
            <button style={styles.secondaryButton} onClick={() => setText('')}>Clear</button>
            <button style={styles.secondaryButton} onClick={exportCsv}>Export CSV</button>
            <button style={styles.secondaryButton} onClick={saveAllIdeas} disabled={saveAllLoading}>{saveAllLoading ? 'Saving...' : 'Save All'}</button>
          </div>
          {error && <div style={styles.error}>{error}</div>}
        </section>

        <div style={styles.summaryBar}><strong>{summary}</strong></div>

        {activeView === 'sources' && (
          <section style={styles.infoPanel}>
            <h2 style={styles.sectionTitle}>Best Places To Scan</h2>
            <div style={styles.sourceGrid}>
              {['Reddit repair communities', 'Facebook local groups', 'YouTube repair comments', 'Amazon bad reviews', 'Appliance forums', 'TikTok organization comments'].map((item) => <div style={styles.sourceCard} key={item}>{item}</div>)}
            </div>
          </section>
        )}

        {activeView === 'scores' && (
          <section style={styles.infoPanel}>
            <h2 style={styles.sectionTitle}>Score Snapshot</h2>
            <div style={styles.metricGrid}>
              <Metric label="Average score" value={`${stats.avg}/100`} />
              <Metric label="High demand" value={stats.high} />
              <Metric label="Easy prints" value={stats.easy} />
            </div>
          </section>
        )}

        {activeView === 'catalogue' && (
          <section style={styles.cataloguePanel}>
            <div>
              <h2 style={styles.sectionTitle}>Catalogue Builder</h2>
              <p style={styles.scanHint}>Search, filter, and spot duplicate ideas before the list grows too big.</p>
            </div>
            <div style={styles.catalogueGrid}>
              <input style={styles.input} value={catalogueSearch} onChange={(e) => setCatalogueSearch(e.target.value)} placeholder="Search product, keyword, note..." />
              <select style={styles.input} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                {categoryOptions.map((category) => <option key={category}>{category}</option>)}
              </select>
              <select style={styles.input} value={materialFilter} onChange={(e) => setMaterialFilter(e.target.value)}>
                {materialOptions.map((material) => <option key={material}>{material}</option>)}
              </select>
              <select style={styles.input} value={minScoreFilter} onChange={(e) => setMinScoreFilter(e.target.value)}>
                <option value="0">Any score</option>
                <option value="60">60+</option>
                <option value="75">75+</option>
                <option value="85">85+</option>
              </select>
            </div>
            <label style={styles.inlineCheck}>
              <input type="checkbox" checked={duplicatesOnly} onChange={(e) => setDuplicatesOnly(e.target.checked)} />
              Show likely duplicates only
            </label>
          </section>
        )}

        <div style={styles.resultsHeader}>
          <h2 style={styles.sectionTitle}>{activeView === 'catalogue' ? 'Catalogue Results' : 'Ranked Ideas'}</h2>
          <div style={styles.headerTools}>
            <span>{visibleIdeas.length} shown</span>
            <button style={styles.secondaryButton} onClick={exportCsv}>Export</button>
            <button style={styles.secondaryButton} onClick={saveAllIdeas} disabled={saveAllLoading}>Save all</button>
            <select style={styles.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option>All</option>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
        </div>

        <div style={styles.resultsList}>
          {visibleIdeas.map((idea) => (
            <button key={idea.id} style={{ ...styles.resultRow, border: selected?.id === idea.id ? '2px solid #16a34a' : '1px solid #dbe3ec' }} onClick={() => setSelectedId(idea.id)}>
              <div style={styles.rankBox}><strong>{idea.score}</strong><small>{idea.demand}</small></div>
              <div style={{ ...styles.visualCard, borderColor: visualAccent(idea) }}>
                <span style={{ ...styles.visualMark, color: visualAccent(idea) }}>{visualLabel(idea)}</span>
                <small>{idea.category}</small>
              </div>
              <div style={styles.ideaMain}>
                <div style={styles.rowCompact}>
                  <span style={styles.category}>{idea.category}</span>
                  <span style={styles.triggerText}>{idea.status}</span>
                  <span style={styles.triggerText}>{idea.material}</span>
                  <span style={styles.signalBadge}>{idea.evidenceCount || 1} signals</span>
                  {(duplicateCounts.get(ideaFingerprint(idea)) || 0) > 1 && (
                    <span style={styles.duplicateBadge}>similar x{duplicateCounts.get(ideaFingerprint(idea))}</span>
                  )}
                </div>
                <h2 style={styles.cardTitle}>{idea.title}</h2>
                <p style={styles.cardText}>{idea.reason}</p>
              </div>
              <div style={styles.resultMeta}>
                <Info label="Price" value={idea.priceRange} />
                <Info label="Cost" value={idea.printCost} />
                <Info label="Risk" value={idea.riskLevel} />
              </div>
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <aside style={styles.detailPanel}>
          <div style={{ ...styles.heroVisual, borderColor: visualAccent(selected) }}>
            <span style={{ ...styles.heroMark, color: visualAccent(selected) }}>{visualLabel(selected)}</span>
            <small>{selected.category}</small>
          </div>
          <div style={styles.detailScore}><strong>{selected.score}</strong><span>{selected.demand} demand</span></div>
          <div style={styles.detailMeta}>{selected.category}</div>
          <h2 style={styles.detailTitle}>{selected.title}</h2>
          <p style={styles.detailText}>{selected.reason}</p>

          <label style={styles.label}>Status
            <select style={styles.input} value={selected.status} onChange={(e) => updateIdea(selected.id, { status: e.target.value, rejectReason: e.target.value === 'Rejected' ? selected.rejectReason : '' })}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>

          {selected.status === 'Rejected' && (
            <label style={styles.label}>Reject reason
              <select style={styles.input} value={selected.rejectReason || ''} onChange={(e) => updateIdea(selected.id, { rejectReason: e.target.value })}>
                <option value="">Choose reason</option>
                {REJECT_REASONS.map((reason) => <option key={reason}>{reason}</option>)}
              </select>
            </label>
          )}

          <div style={styles.quickActions}>
            <button style={styles.secondaryButton} onClick={copyListing}>Copy listing</button>
            <button style={styles.secondaryButton} onClick={saveIdea}>Save</button>
          </div>

          <div style={styles.detailGrid}>
            <Info label="Material" value={selected.material} />
            <Info label="Risk" value={selected.riskLevel} />
            <Info label="Signals" value={selected.evidenceCount || 1} />
            <Info label="Print time" value={selected.printTime} />
            <Info label="Competition" value={selected.competition} />
            <Info label="Profit" value={selected.profitPotential} />
            <Info label="Repeat buyer" value={selected.repeatBuyers} />
          </div>

          <Panel title="Score Breakdown">
            <ScoreBars data={selected.scoreBreakdown} />
          </Panel>

          {selected.problemQuote && <Panel title="People are saying"><p>{selected.problemQuote}</p></Panel>}
          {selected.mergedPhrases?.length > 0 && (
            <Panel title="Grouped Signals">
              <div style={styles.keywordList}>{selected.mergedPhrases.map((phrase) => <span key={phrase}>{phrase}</span>)}</div>
            </Panel>
          )}
          <Panel title="Printable Solution"><p>{selected.printableSolution || selected.customerProblem}</p></Panel>
          <Panel title="Risk Reason"><p>{selected.riskReason}</p></Panel>

          <Panel title="Validation Checklist">
            <div style={styles.checkList}>
              {(selected.validationTasks || defaultTasks).map((task) => (
                <label key={task} style={styles.checkItem}>
                  <input type="checkbox" checked={(selected.checkedTasks || []).includes(task)} onChange={() => toggleTask(task)} />
                  {task}
                </label>
              ))}
            </div>
          </Panel>

          <Panel title="Research Links">
            <div style={styles.linkGrid}>
              <a style={styles.linkButton} href={`https://www.google.com/search?q=${researchQuery(selected)}`} target="_blank">Google</a>
              <a style={styles.linkButton} href={`https://www.google.com/search?tbm=isch&q=${researchQuery(selected)}`} target="_blank">Images</a>
              <a style={styles.linkButton} href={`https://www.etsy.com/search?q=${researchQuery(selected)}`} target="_blank">Etsy</a>
              <a style={styles.linkButton} href={`https://www.aliexpress.com/wholesale?SearchText=${researchQuery(selected)}`} target="_blank">AliExpress</a>
              <a style={styles.linkButton} href={`https://www.printables.com/search/models?q=${researchQuery(selected)}`} target="_blank">Printables</a>
              <a style={styles.linkButton} href={`https://www.thingiverse.com/search?q=${researchQuery(selected)}&type=things`} target="_blank">Thingiverse</a>
            </div>
          </Panel>

          <Panel title="Prototype Brief">
            <button style={styles.buttonFull} onClick={generateBrief} disabled={briefLoading}>{briefLoading ? 'Generating...' : 'Make Prototype Brief'}</button>
            <List title="Steps" items={selected.prototypeSteps} />
            <List title="Measurements" items={selected.measurementsNeeded} />
            {selected.cadBrief && <p style={styles.textBlock}>{selected.cadBrief}</p>}
          </Panel>

          <Panel title="Product Concept">
            <button style={styles.buttonFull} onClick={generateConcept} disabled={conceptLoading}>{conceptLoading ? 'Generating...' : 'Generate Concept Image'}</button>
            {selected.conceptImage && <img style={styles.conceptImage} src={selected.conceptImage} alt={`${selected.title} concept`} />}
            {selected.conceptPrompt && <p style={styles.textBlock}>{selected.conceptPrompt}</p>}
          </Panel>

          <Panel title="Listing Draft">
            <button style={styles.copyButton} onClick={copyListing}>Copy Facebook listing</button>
            <input style={styles.input} value={selected.listingTitle || ''} onChange={(e) => updateIdea(selected.id, { listingTitle: e.target.value })} placeholder="Listing title" />
            <textarea style={styles.smallTextarea} value={selected.listingDescription || ''} onChange={(e) => updateIdea(selected.id, { listingDescription: e.target.value })} placeholder="Listing description" />
          </Panel>

          <Panel title="Notes">
            <textarea style={styles.smallTextarea} value={selected.notes || ''} onChange={(e) => updateIdea(selected.id, { notes: e.target.value })} placeholder="Supplier links, STL link, print settings, test notes..." />
          </Panel>

          <div style={styles.keywordList}>{selected.keywords?.map((keyword) => <span key={keyword}>{keyword}</span>)}</div>
          <button style={styles.saveButton} onClick={saveIdea}>Save Idea</button>
        </aside>
      )}
    </main>
  );
}

function NavButton({ active, onClick, children }) {
  return <button style={active ? styles.menuActive : styles.menuItem} onClick={onClick}>{children}</button>;
}

function Info({ label, value }) {
  return <div style={styles.infoBox}><small>{label}</small><strong>{value}</strong></div>;
}

function Metric({ label, value }) {
  return <div style={styles.metric}><small>{label}</small><strong>{value}</strong></div>;
}

function Panel({ title, children }) {
  return <section style={styles.panel}><strong>{title}</strong>{children}</section>;
}

function List({ title, items = [] }) {
  if (!items.length) return null;
  return <div style={styles.listBlock}><small>{title}</small>{items.map((item) => <p key={item}>{item}</p>)}</div>;
}

function ScoreBars({ data = {} }) {
  const rows = [
    ['Demand', data.demand],
    ['Print', data.printDifficulty],
    ['Profit', data.profit],
    ['Competition', data.competition],
    ['Shipping', data.shipping],
    ['Repeat', data.repeatBuyers],
  ];
  return <div style={styles.bars}>{rows.map(([label, value]) => <div key={label} style={styles.barRow}><span>{label}</span><div style={styles.barTrack}><div style={{ ...styles.barFill, width: `${Math.min(Number(value || 0), 100)}%` }} /></div><strong>{value || 0}</strong></div>)}</div>;
}

const styles = {
  app: { minHeight: '100vh', display: 'grid', gridTemplateColumns: '176px minmax(0, 1fr) 330px', background: '#f6f8fb', color: '#101827', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  sidebar: { background: '#ffffff', borderRight: '1px solid #dbe3ec', padding: 16 },
  logoMark: { width: 34, height: 34, borderRadius: 8, display: 'grid', placeItems: 'center', background: '#111827', color: '#ffffff', fontWeight: 900, marginBottom: 10 },
  logoText: { fontSize: 20, fontWeight: 900, marginBottom: 26, color: '#15803d' },
  menuTitle: { fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 800, marginBottom: 12 },
  menuActive: { width: '100%', padding: '11px 12px', background: '#dcfce7', color: '#166534', border: 'none', borderRadius: 8, fontWeight: 800, marginBottom: 8, cursor: 'pointer', textAlign: 'left' },
  menuItem: { width: '100%', padding: '11px 12px', color: '#475569', background: 'transparent', border: 'none', borderRadius: 8, marginBottom: 6, cursor: 'pointer', textAlign: 'left', fontWeight: 700 },
  sidebarBox: { marginTop: 34, padding: 14, background: '#eef2f7', borderRadius: 8 },
  content: { padding: 24, overflow: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 20 },
  title: { fontSize: 29, margin: 0, letterSpacing: 0 },
  subtitle: { marginTop: 6, color: '#64748b', fontSize: 14 },
  privateMode: { color: '#15803d', fontWeight: 800, background: '#dcfce7', borderRadius: 8, padding: '8px 10px', whiteSpace: 'nowrap' },
  scanPanel: { background: '#ffffff', border: '1px solid #dbe3ec', borderRadius: 8, padding: 14, marginBottom: 12 },
  scanHeader: { display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 280px', gap: 14, alignItems: 'start', marginBottom: 12 },
  scanTitle: { margin: 0, fontSize: 18, lineHeight: 1.2 },
  scanHint: { margin: '5px 0 0', color: '#64748b', fontSize: 13, lineHeight: 1.4 },
  scanStats: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  inputRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, color: '#475569', fontSize: 12, fontWeight: 800, marginBottom: 10 },
  input: { height: 42, border: '1px solid #cbd5e1', borderRadius: 8, padding: '0 12px', color: '#101827', fontSize: 14, background: '#ffffff' },
  select: { height: 38, border: '1px solid #cbd5e1', borderRadius: 8, padding: '0 10px', background: '#ffffff', fontWeight: 800 },
  textarea: { width: '100%', minHeight: 116, border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, fontSize: 14, resize: 'vertical', outline: 'none', color: '#101827', lineHeight: 1.5 },
  smallTextarea: { width: '100%', minHeight: 78, border: '1px solid #cbd5e1', borderRadius: 8, padding: 10, fontSize: 13, resize: 'vertical', color: '#101827', marginTop: 8 },
  actionRow: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  button: { background: '#16a34a', border: 'none', color: '#ffffff', padding: '12px 18px', borderRadius: 8, fontWeight: 900, cursor: 'pointer' },
  buttonAlt: { background: '#0f766e', border: 'none', color: '#ffffff', padding: '12px 18px', borderRadius: 8, fontWeight: 900, cursor: 'pointer' },
  buttonFull: { width: '100%', background: '#16a34a', border: 'none', color: '#ffffff', padding: '11px 14px', borderRadius: 8, fontWeight: 900, cursor: 'pointer', marginTop: 10 },
  secondaryButton: { background: '#eef2f7', border: '1px solid #dbe3ec', color: '#101827', padding: '11px 14px', borderRadius: 8, fontWeight: 800, cursor: 'pointer' },
  summaryBar: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#14532d', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 13 },
  error: { marginTop: 12, padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontWeight: 700 },
  infoPanel: { background: '#ffffff', border: '1px solid #dbe3ec', borderRadius: 8, padding: 16, marginBottom: 22 },
  cataloguePanel: { background: '#ffffff', border: '1px solid #dbe3ec', borderRadius: 8, padding: 14, marginBottom: 14 },
  catalogueGrid: { display: 'grid', gridTemplateColumns: 'minmax(180px, 1.4fr) repeat(3, minmax(120px, 1fr))', gap: 10, marginTop: 12 },
  inlineCheck: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, color: '#334155', fontWeight: 800, fontSize: 13 },
  sectionTitle: { margin: 0, fontSize: 18 },
  sourceGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))', gap: 10, marginTop: 12 },
  sourceCard: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, color: '#334155', fontWeight: 700 },
  metricGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 },
  metric: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 4 },
  resultsHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#475569', margin: '0 0 10px', fontSize: 13 },
  headerTools: { display: 'flex', alignItems: 'center', gap: 8 },
  resultsList: { display: 'grid', gap: 10 },
  resultRow: { background: '#ffffff', borderRadius: 8, textAlign: 'left', cursor: 'pointer', padding: 12, display: 'grid', gridTemplateColumns: '64px 112px minmax(0, 1fr) 300px', gap: 12, alignItems: 'stretch' },
  rankBox: { borderRadius: 8, background: '#ecfdf5', color: '#14532d', display: 'grid', placeItems: 'center', alignContent: 'center', minHeight: 82, gap: 2 },
  visualCard: { width: '100%', height: 82, borderRadius: 8, border: '2px solid #dbe3ec', background: '#f8fafc', display: 'grid', placeItems: 'center', alignContent: 'center', gap: 4, padding: 8, textAlign: 'center' },
  visualMark: { fontSize: 24, fontWeight: 900, lineHeight: 1 },
  ideaMain: { minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  rowCompact: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, flexWrap: 'wrap' },
  triggerText: { color: '#64748b', fontWeight: 900, fontSize: 12 },
  signalBadge: { color: '#14532d', background: '#dcfce7', borderRadius: 999, padding: '4px 7px', fontWeight: 900, fontSize: 11 },
  duplicateBadge: { color: '#7c2d12', background: '#ffedd5', borderRadius: 999, padding: '4px 7px', fontWeight: 900, fontSize: 11 },
  category: { background: '#e0f2fe', color: '#075985', padding: '5px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800 },
  cardTitle: { fontSize: 17, margin: '0 0 6px', lineHeight: 1.25 },
  cardText: { color: '#475569', lineHeight: 1.45, fontSize: 13, margin: 0 },
  resultMeta: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 },
  detailPanel: { background: '#ffffff', borderLeft: '1px solid #dbe3ec', padding: 18, overflow: 'auto' },
  heroVisual: { width: '100%', height: 140, borderRadius: 8, border: '2px solid #dbe3ec', background: '#f8fafc', marginBottom: 12, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 6 },
  heroMark: { fontSize: 44, fontWeight: 900, lineHeight: 1 },
  detailScore: { minHeight: 82, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#14532d', background: '#ecfdf5', borderRadius: 8, marginBottom: 14, gap: 3 },
  detailMeta: { color: '#075985', fontWeight: 900, fontSize: 12, marginBottom: 8 },
  detailTitle: { fontSize: 22, margin: '0 0 8px', lineHeight: 1.2 },
  detailText: { color: '#475569', lineHeight: 1.55, marginBottom: 14 },
  detailGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 },
  infoBox: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 5 },
  panel: { marginTop: 12, padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, color: '#263244' },
  quickActions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 },
  checkList: { display: 'grid', gap: 8, marginTop: 10 },
  checkItem: { display: 'flex', alignItems: 'center', gap: 8, color: '#334155', fontSize: 13, fontWeight: 700 },
  linkGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 },
  linkButton: { display: 'grid', placeItems: 'center', minHeight: 36, borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', textDecoration: 'none', fontWeight: 800, fontSize: 13 },
  bars: { display: 'grid', gap: 8, marginTop: 10 },
  barRow: { display: 'grid', gridTemplateColumns: '76px 1fr 34px', gap: 8, alignItems: 'center', fontSize: 12 },
  barTrack: { height: 8, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999, background: '#16a34a' },
  listBlock: { marginTop: 10 },
  textBlock: { margin: '10px 0 0', color: '#334155', lineHeight: 1.45 },
  conceptImage: { width: '100%', borderRadius: 8, border: '1px solid #e2e8f0', marginTop: 10 },
  copyButton: { width: '100%', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', padding: '10px 12px', borderRadius: 8, fontWeight: 900, cursor: 'pointer', margin: '10px 0' },
  keywordList: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  saveButton: { marginTop: 16, width: '100%', padding: 13, borderRadius: 8, border: 'none', background: '#111827', color: '#ffffff', fontWeight: 900, cursor: 'pointer' },
};
