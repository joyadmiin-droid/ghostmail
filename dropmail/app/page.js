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
            <h1 style={styles.title}>AI Idea Finder for 3D Products</h1>
            <p style={styles.subtitle}>
              Find useful parts people already need before you spend time printing.
            </p>
          </div>
          <div style={styles.privateMode}>Private scan</div>
        </header>

        <section style={styles.scanPanel}>
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
            placeholder="Paste posts, comments, reviews, or forum threads here..."
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
            <span style={styles.summary}>{summary}</span>
          </div>

          {error && <div style={styles.error}>{error}</div>}
        </section>

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

        <div style={styles.grid}>
          {ideas.map((idea) => (
            <button
              key={idea.id}
              style={{
                ...styles.card,
                border:
                  selected?.id === idea.id
                    ? '2px solid #16a34a'
                    : '1px solid #dbe3ec',
              }}
              onClick={() => setSelected(idea)}
            >
              <div style={styles.cardTop}>
                <div style={styles.productMark}>{idea.image}</div>
                <div style={styles.scorePill}>{idea.score}</div>
              </div>

              <div style={styles.cardBody}>
                <div style={styles.row}>
                  <span style={styles.category}>{idea.category}</span>
                  <span style={styles.demand}>{idea.demand}</span>
                </div>

                <h2 style={styles.cardTitle}>{idea.title}</h2>
                <p style={styles.cardText}>{idea.reason}</p>

                <div style={styles.signalBox}>
                  <small>Trigger</small>
                  <strong>{idea.triggerPhrase}</strong>
                </div>

                <div style={styles.cardStats}>
                  <div>
                    <small>Price</small>
                    <strong>{idea.priceRange}</strong>
                  </div>
                  <div>
                    <small>Cost</small>
                    <strong>{idea.printCost}</strong>
                  </div>
                </div>
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

          <div style={styles.bigMark}>{selected.image}</div>
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
    gridTemplateColumns: '220px minmax(0, 1fr) 340px',
    background: '#f6f8fb',
    color: '#101827',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  sidebar: {
    background: '#ffffff',
    borderRight: '1px solid #dbe3ec',
    padding: 20,
  },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 8,
    display: 'grid',
    placeItems: 'center',
    background: '#111827',
    color: '#ffffff',
    fontWeight: 900,
    marginBottom: 10,
  },
  logoText: {
    fontSize: 22,
    fontWeight: 900,
    marginBottom: 30,
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
    padding: '12px 14px',
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
    padding: '12px 14px',
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
    padding: 28,
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
    fontSize: 32,
    margin: 0,
    letterSpacing: 0,
  },
  subtitle: {
    marginTop: 6,
    color: '#64748b',
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
    padding: 16,
    marginBottom: 22,
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
    minHeight: 150,
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
    margin: '0 0 14px',
    fontSize: 20,
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
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(210px, 1fr))',
    gap: 16,
  },
  card: {
    background: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
    textAlign: 'left',
    cursor: 'pointer',
    padding: 0,
  },
  cardTop: {
    height: 118,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    background: '#edf2f7',
  },
  productMark: {
    width: 64,
    height: 64,
    borderRadius: 8,
    display: 'grid',
    placeItems: 'center',
    background: '#ffffff',
    border: '1px solid #dbe3ec',
    color: '#15803d',
    fontWeight: 900,
    fontSize: 20,
  },
  scorePill: {
    position: 'absolute',
    top: 12,
    right: 12,
    borderRadius: 999,
    background: '#dcfce7',
    color: '#166534',
    padding: '5px 9px',
    fontWeight: 900,
    fontSize: 12,
  },
  cardBody: {
    padding: 16,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
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
    fontSize: 18,
    margin: '0 0 8px',
    lineHeight: 1.25,
  },
  cardText: {
    color: '#475569',
    lineHeight: 1.45,
    fontSize: 13,
    minHeight: 74,
  },
  signalBox: {
    marginTop: 12,
    padding: 10,
    background: '#f8fafc',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  cardStats: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    marginTop: 12,
  },
  detailPanel: {
    background: '#ffffff',
    borderLeft: '1px solid #dbe3ec',
    padding: 20,
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
  bigMark: {
    height: 150,
    display: 'grid',
    placeItems: 'center',
    fontSize: 38,
    fontWeight: 900,
    color: '#15803d',
    background: '#f8fafc',
    borderRadius: 8,
    marginBottom: 16,
  },
  detailMeta: {
    color: '#075985',
    fontWeight: 900,
    fontSize: 12,
    marginBottom: 8,
  },
  detailTitle: {
    fontSize: 24,
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
    padding: 12,
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
