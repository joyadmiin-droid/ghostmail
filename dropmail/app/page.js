'use client';

import { useMemo, useState } from 'react';

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
    sourceIcon: 'AI',
    demand: 'High',
    score: 91,
    confidence: 'High',
    triggerPhrase: 'where can I buy',
    problemQuote:
      'Where can I buy replacement wheels for an old dishwasher rack?',
    customerProblem:
      'Dishwasher rack wheels break, disappear, or become expensive to replace.',
    printableSolution:
      'A small clip-on wheel or roller set sized for common dishwasher racks.',
    priceRange: '250-700 MKD',
    printCost: '30-90 MKD',
    weight: '20-60g',
    size: '2cm x 2cm each',
    market: 'Home repair / appliance owners',
    difficulty: 'Medium',
    profitPotential: 'High',
    reason:
      'Replacement parts are small, practical, and buyers search for them when something is already broken.',
    keywords: ['dishwasher rack wheel', 'dishwasher roller', 'rack replacement part'],
  },
  {
    id: 2,
    title: 'Desk Cable Catcher Clip',
    category: 'Desk Organizer',
    image: 'CC',
    source: 'Example Scan',
    sourceIcon: 'AI',
    demand: 'High',
    score: 86,
    confidence: 'High',
    triggerPhrase: 'I need',
    problemQuote:
      'I need something to hold my charger cable because it always falls behind my desk.',
    customerProblem:
      'Charging cables fall behind desks and are annoying to reach every day.',
    printableSolution:
      'A stick-on or clamp-on cable catcher that holds one to three cables.',
    priceRange: '150-350 MKD',
    printCost: '15-45 MKD',
    weight: '10-35g',
    size: '4cm x 3cm',
    market: 'Students, offices, gamers',
    difficulty: 'Easy',
    profitPotential: 'Medium',
    reason:
      'Simple print, low material cost, easy to bundle in multiple colors.',
    keywords: ['desk cable clip', 'charger holder', 'cable catcher'],
  },
  {
    id: 3,
    title: 'Shower Hose Wall Guard',
    category: 'Bathroom Part',
    image: 'SH',
    source: 'Example Scan',
    sourceIcon: 'AI',
    demand: 'Medium',
    score: 78,
    confidence: 'Medium',
    triggerPhrase: 'I hate when',
    problemQuote:
      'I hate when the shower hose scratches the wall. Looking for a small clip or holder.',
    customerProblem:
      'Metal shower hoses scrape tiles or painted walls.',
    printableSolution:
      'A rounded wall guard or adhesive hose guide that keeps the hose away from the surface.',
    priceRange: '150-450 MKD',
    printCost: '20-60 MKD',
    weight: '20-55g',
    size: '6cm x 5cm',
    market: 'Bathroom accessories',
    difficulty: 'Easy',
    profitPotential: 'Medium',
    reason:
      'Bathroom problems are common, visible, and easy to understand from a product photo.',
    keywords: ['shower hose holder', 'wall guard', 'bathroom clip'],
  },
];

function demandLabel(score) {
  if (score >= 80) return 'High';
  if (score >= 55) return 'Medium';
  return 'Low';
}

function normalizeIdea(idea, index, source) {
  const score = Number(idea.demand_score || idea.score || 50);

  return {
    id: `${Date.now()}-${index}`,
    title: idea.product_name || idea.title || 'Untitled Product Idea',
    category: idea.category || '3D Printable Part',
    image: (idea.product_name || 'AI').slice(0, 2).toUpperCase(),
    source,
    sourceIcon: 'AI',
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
    reason:
      idea.why_it_can_sell ||
      idea.reasoning ||
      'AI detected possible demand for a printable product.',
    keywords: Array.isArray(idea.validation_keywords)
      ? idea.validation_keywords
      : [],
  };
}

export default function Home() {
  const [text, setText] = useState(sampleText);
  const [source, setSource] = useState('Reddit / comments');
  const [niche, setNiche] = useState('Home, kitchen, bathroom, machines');
  const [ideas, setIdeas] = useState(starterIdeas);
  const [selected, setSelected] = useState(starterIdeas[0]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState('finder');
  const [summary, setSummary] = useState(
    'Paste comments or posts, then scan them for real buying intent.'
  );
  const [error, setError] = useState('');

  const stats = useMemo(() => {
    const high = ideas.filter((idea) => idea.score >= 80).length;
    const easy = ideas.filter((idea) => idea.difficulty === 'Easy').length;
    const avg =
      ideas.length === 0
        ? 0
        : Math.round(
            ideas.reduce((total, idea) => total + Number(idea.score || 0), 0) /
              ideas.length
          );

    return { high, easy, avg };
  }, [ideas]);

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

      if (!res.ok) {
        throw new Error(json.error || 'Analysis failed');
      }

      const newIdeas = (json.data?.ideas || []).map((idea, index) =>
        normalizeIdea(idea, index, source)
      );

      setSummary(
        json.data?.summary ||
          (newIdeas.length
            ? `Found ${newIdeas.length} product opportunities.`
            : 'No strong 3D-printable demand found in this text.')
      );

      if (newIdeas.length) {
        setIdeas(newIdeas);
        setSelected(newIdeas[0]);
        setActiveView('finder');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not analyze this text.');
      setSummary('The scan did not complete. Check the API key and try again.');
    }

    setLoading(false);
  }

  async function loadSavedIdeas() {
    setError('');

    try {
      const res = await fetch('/api/saved');
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Could not load saved ideas');
      }

      const savedIdeas = json.data.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        image: item.raw_data?.image || item.title?.slice(0, 2).toUpperCase() || 'AI',
        source: item.source,
        sourceIcon: item.source_icon || 'AI',
        demand: item.demand,
        score: item.score,
        confidence: item.raw_data?.confidence || 'Saved',
        triggerPhrase: item.raw_data?.triggerPhrase || 'Saved idea',
        problemQuote: item.raw_data?.problemQuote || '',
        customerProblem: item.raw_data?.customerProblem || '',
        printableSolution: item.raw_data?.printableSolution || '',
        priceRange: item.price_range,
        printCost: item.print_cost,
        weight: item.weight,
        size: item.size,
        market: item.market,
        difficulty: item.difficulty,
        profitPotential: item.raw_data?.profitPotential || 'Medium',
        reason: item.reason,
        keywords: item.raw_data?.keywords || [],
      }));

      setIdeas(savedIdeas);
      setSelected(savedIdeas[0] || null);
      setSummary(
        savedIdeas.length
          ? `Loaded ${savedIdeas.length} saved opportunities.`
          : 'No saved ideas yet.'
      );
      setActiveView('saved');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error loading saved ideas');
    }
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

      if (!json.success) {
        throw new Error(json.error || 'Error saving');
      }

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

        <button
          style={activeView === 'finder' ? styles.menuActive : styles.menuItem}
          onClick={() => setActiveView('finder')}
        >
          Idea Finder
        </button>
        <button
          style={activeView === 'saved' ? styles.menuActive : styles.menuItem}
          onClick={loadSavedIdeas}
        >
          Saved Ideas
        </button>
        <button
          style={activeView === 'sources' ? styles.menuActive : styles.menuItem}
          onClick={() => setActiveView('sources')}
        >
          Sources
        </button>
        <button
          style={activeView === 'scores' ? styles.menuActive : styles.menuItem}
          onClick={() => setActiveView('scores')}
        >
          Demand Scores
        </button>

        <div style={styles.sidebarBox}>
          <strong>{ideas.length}</strong>
          <span> ideas found</span>
        </div>
      </aside>

      <section style={styles.content}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>3D Product Idea Finder</h1>
            <p style={styles.subtitle}>
              Paste real comments. Get ranked printable product ideas.
            </p>
          </div>
          <div style={styles.privateMode}>Live AI scan</div>
        </header>

        <section style={styles.scanPanel}>
          <div style={styles.scanHeader}>
            <div>
              <h2 style={styles.scanTitle}>Scan Demand</h2>
              <p style={styles.scanHint}>
                Best input: complaints, repair questions, reviews, and buying posts.
              </p>
            </div>
            <div style={styles.scanStats}>
              <Metric label="Avg score" value={`${stats.avg}/100`} />
              <Metric label="High" value={stats.high} />
              <Metric label="Easy" value={stats.easy} />
            </div>
          </div>

          <div style={styles.inputRow}>
            <label style={styles.label}>
              Source
              <input
                style={styles.input}
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Reddit, Facebook group, YouTube comments..."
              />
            </label>
            <label style={styles.label}>
              Niche
              <input
                style={styles.input}
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Kitchen, bathroom, machines, cars..."
              />
            </label>
          </div>

          <textarea
            style={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste comments, posts, reviews, or forum threads here..."
          />

          <div style={styles.actionRow}>
            <button style={styles.button} onClick={analyzeDemand} disabled={loading}>
              {loading ? 'Scanning...' : 'Scan Demand'}
            </button>
            <button
              style={styles.secondaryButton}
              onClick={() => setText(sampleText)}
            >
              Load Example
            </button>
            <button
              style={styles.secondaryButton}
              onClick={() => {
                setText('');
                setSummary('Paste comments or posts, then scan them for real buying intent.');
              }}
            >
              Clear
            </button>
          </div>

          {error && <div style={styles.error}>{error}</div>}
        </section>

        <div style={styles.summaryBar}>
          <strong>{summary}</strong>
        </div>

        {activeView === 'sources' && (
          <section style={styles.infoPanel}>
            <h2 style={styles.sectionTitle}>Best Places To Scan</h2>
            <div style={styles.sourceGrid}>
              {[
                'Reddit repair and hobby communities',
                'Facebook local buy/sell groups',
                'YouTube comments under repair videos',
                'Amazon and AliExpress bad reviews',
                'Appliance, car, bike, and machine forums',
                'TikTok comments on organization and repair videos',
              ].map((item) => (
                <div style={styles.sourceCard} key={item}>
                  {item}
                </div>
              ))}
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

        <div style={styles.resultsHeader}>
          <h2 style={styles.sectionTitle}>Ranked Ideas</h2>
          <span>{ideas.length} opportunities</span>
        </div>

        <div style={styles.resultsList}>
          {ideas.map((idea) => (
            <button
              key={idea.id}
              style={{
                ...styles.resultRow,
                border:
                  selected?.id === idea.id
                    ? '2px solid #16a34a'
                    : '1px solid #dbe3ec',
              }}
              onClick={() => setSelected(idea)}
            >
              <div style={styles.rankBox}>
                <strong>{idea.score}</strong>
                <small>{idea.demand}</small>
              </div>
              <div style={styles.ideaMain}>
                <div style={styles.rowCompact}>
                  <span style={styles.category}>{idea.category}</span>
                  <span style={styles.triggerText}>{idea.triggerPhrase}</span>
                </div>
                <h2 style={styles.cardTitle}>{idea.title}</h2>
                <p style={styles.cardText}>{idea.reason}</p>
              </div>
              <div style={styles.resultMeta}>
                <Info label="Price" value={idea.priceRange} />
                <Info label="Cost" value={idea.printCost} />
                <Info label="Difficulty" value={idea.difficulty} />
              </div>
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <aside style={styles.detailPanel}>
          <button style={styles.close} onClick={() => setSelected(null)}>
            x
          </button>

          <div style={styles.detailScore}>
            <strong>{selected.score}</strong>
            <span>{selected.demand} demand</span>
          </div>
          <div style={styles.detailMeta}>{selected.category}</div>
          <h2 style={styles.detailTitle}>{selected.title}</h2>
          <p style={styles.detailText}>{selected.reason}</p>

          {selected.problemQuote && (
            <div style={styles.quoteBox}>
              <small>People are saying</small>
              <p>{`"${selected.problemQuote}"`}</p>
            </div>
          )}

          <div style={styles.detailGrid}>
            <Info label="Demand" value={selected.demand} />
            <Info label="Score" value={`${selected.score}/100`} />
            <Info label="Confidence" value={selected.confidence} />
            <Info label="Difficulty" value={selected.difficulty} />
            <Info label="Selling price" value={selected.priceRange} />
            <Info label="Print cost" value={selected.printCost} />
            <Info label="Weight" value={selected.weight} />
            <Info label="Size" value={selected.size} />
          </div>

          <div style={styles.origin}>
            <strong>Printable solution</strong>
            <p>{selected.printableSolution || selected.customerProblem}</p>
          </div>

          {selected.customerProblem && (
            <div style={styles.problemBox}>
              <strong>Customer problem</strong>
              <p>{selected.customerProblem}</p>
            </div>
          )}

          {selected.keywords?.length > 0 && (
            <div style={styles.keywordList}>
              {selected.keywords.map((keyword) => (
                <span key={keyword}>{keyword}</span>
              ))}
            </div>
          )}

          <button style={styles.saveButton} onClick={saveIdea}>
            Save Idea
          </button>
        </aside>
      )}
    </main>
  );
}

function Info({ label, value }) {
  return (
    <div style={styles.infoBox}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={styles.metric}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

const styles = {
  app: {
    minHeight: '100vh',
    display: 'grid',
    gridTemplateColumns: '176px minmax(0, 1fr) 306px',
    background: '#f6f8fb',
    color: '#101827',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  sidebar: {
    background: '#ffffff',
    borderRight: '1px solid #dbe3ec',
    padding: 16,
  },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 8,
    display: 'grid',
    placeItems: 'center',
    background: '#111827',
    color: '#ffffff',
    fontWeight: 900,
    marginBottom: 10,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 900,
    marginBottom: 26,
    color: '#15803d',
  },
  menuTitle: {
    fontSize: 11,
    textTransform: 'uppercase',
    color: '#64748b',
    fontWeight: 800,
    marginBottom: 12,
  },
  menuActive: {
    width: '100%',
    padding: '11px 12px',
    background: '#dcfce7',
    color: '#166534',
    border: 'none',
    borderRadius: 8,
    fontWeight: 800,
    marginBottom: 8,
    cursor: 'pointer',
    textAlign: 'left',
  },
  menuItem: {
    width: '100%',
    padding: '11px 12px',
    color: '#475569',
    background: 'transparent',
    border: 'none',
    borderRadius: 8,
    marginBottom: 6,
    cursor: 'pointer',
    textAlign: 'left',
    fontWeight: 700,
  },
  sidebarBox: {
    marginTop: 34,
    padding: 14,
    background: '#eef2f7',
    borderRadius: 8,
  },
  content: {
    padding: 24,
    overflow: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 29,
    margin: 0,
    letterSpacing: 0,
  },
  subtitle: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 14,
  },
  privateMode: {
    color: '#15803d',
    fontWeight: 800,
    background: '#dcfce7',
    borderRadius: 8,
    padding: '8px 10px',
    whiteSpace: 'nowrap',
  },
  scanPanel: {
    background: '#ffffff',
    border: '1px solid #dbe3ec',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  scanHeader: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1fr) 280px',
    gap: 14,
    alignItems: 'start',
    marginBottom: 12,
  },
  scanTitle: {
    margin: 0,
    fontSize: 18,
    lineHeight: 1.2,
  },
  scanHint: {
    margin: '5px 0 0',
    color: '#64748b',
    fontSize: 13,
    lineHeight: 1.4,
  },
  scanStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  inputRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginBottom: 12,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    color: '#475569',
    fontSize: 12,
    fontWeight: 800,
  },
  input: {
    height: 42,
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: '0 12px',
    color: '#101827',
    fontSize: 14,
  },
  textarea: {
    width: '100%',
    minHeight: 116,
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    resize: 'vertical',
    outline: 'none',
    color: '#101827',
    lineHeight: 1.5,
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  button: {
    background: '#16a34a',
    border: 'none',
    color: '#ffffff',
    padding: '12px 18px',
    borderRadius: 8,
    fontWeight: 900,
    cursor: 'pointer',
  },
  secondaryButton: {
    background: '#eef2f7',
    border: '1px solid #dbe3ec',
    color: '#101827',
    padding: '11px 14px',
    borderRadius: 8,
    fontWeight: 800,
    cursor: 'pointer',
  },
  summary: {
    color: '#64748b',
    fontSize: 13,
  },
  summaryBar: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#14532d',
    borderRadius: 8,
    padding: '10px 12px',
    marginBottom: 14,
    fontSize: 13,
  },
  error: {
    marginTop: 12,
    padding: 12,
    background: '#fee2e2',
    color: '#991b1b',
    borderRadius: 8,
    fontWeight: 700,
  },
  infoPanel: {
    background: '#ffffff',
    border: '1px solid #dbe3ec',
    borderRadius: 8,
    padding: 16,
    marginBottom: 22,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
  },
  sourceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))',
    gap: 10,
  },
  sourceCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: 12,
    color: '#334155',
    fontWeight: 700,
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  },
  metric: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  resultsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: '#475569',
    margin: '0 0 10px',
    fontSize: 13,
  },
  resultsList: {
    display: 'grid',
    gap: 10,
  },
  resultRow: {
    background: '#ffffff',
    borderRadius: 8,
    textAlign: 'left',
    cursor: 'pointer',
    padding: 12,
    display: 'grid',
    gridTemplateColumns: '64px minmax(0, 1fr) 300px',
    gap: 12,
    alignItems: 'stretch',
  },
  rankBox: {
    borderRadius: 8,
    background: '#ecfdf5',
    color: '#14532d',
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    minHeight: 82,
    gap: 2,
  },
  ideaMain: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  rowCompact: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 7,
    flexWrap: 'wrap',
  },
  triggerText: {
    color: '#64748b',
    fontWeight: 900,
    fontSize: 12,
  },
  category: {
    background: '#e0f2fe',
    color: '#075985',
    padding: '5px 8px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 800,
  },
  demand: {
    color: '#15803d',
    fontWeight: 900,
    fontSize: 12,
  },
  cardTitle: {
    fontSize: 17,
    margin: '0 0 6px',
    lineHeight: 1.25,
  },
  cardText: {
    color: '#475569',
    lineHeight: 1.45,
    fontSize: 13,
    margin: 0,
  },
  resultMeta: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 8,
  },
  detailPanel: {
    background: '#ffffff',
    borderLeft: '1px solid #dbe3ec',
    padding: 18,
    position: 'relative',
    overflow: 'auto',
  },
  close: {
    position: 'absolute',
    top: 14,
    right: 14,
    border: 'none',
    background: '#eef2f7',
    width: 32,
    height: 32,
    borderRadius: 8,
    fontSize: 16,
    cursor: 'pointer',
  },
  detailScore: {
    minHeight: 88,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#14532d',
    background: '#ecfdf5',
    borderRadius: 8,
    marginBottom: 14,
    gap: 3,
  },
  detailMeta: {
    color: '#075985',
    fontWeight: 900,
    fontSize: 12,
    marginBottom: 8,
  },
  detailTitle: {
    fontSize: 22,
    margin: '0 0 8px',
    lineHeight: 1.2,
  },
  detailText: {
    color: '#475569',
    lineHeight: 1.55,
    marginBottom: 14,
  },
  quoteBox: {
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    color: '#7c2d12',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  infoBox: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  origin: {
    marginTop: 14,
    padding: 14,
    background: '#ecfdf5',
    borderRadius: 8,
    color: '#14532d',
  },
  problemBox: {
    marginTop: 12,
    padding: 14,
    background: '#eff6ff',
    borderRadius: 8,
    color: '#1e3a8a',
  },
  keywordList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  saveButton: {
    marginTop: 16,
    width: '100%',
    padding: 13,
    borderRadius: 8,
    border: 'none',
    background: '#111827',
    color: '#ffffff',
    fontWeight: 900,
    cursor: 'pointer',
  },
};
