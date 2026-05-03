'use client';

import { useState } from 'react';

const demoIdeas = [
  {
    id: 1,
    title: 'Car Phone Holder',
    category: 'Car Accessories',
    image: '🚗',
    source: 'TikTok',
    sourceIcon: '🎵',
    demand: 'High',
    score: 92,
    priceRange: '250–600 MKD',
    printCost: '35–70 MKD',
    weight: '45–80g',
    size: '10cm × 7cm',
    market: 'Skopje / Macedonia',
    difficulty: 'Easy',
    reason:
      'Many drivers want cheap phone holders for cars. Easy to print, low material cost, good local demand.',
  },
  {
    id: 2,
    title: 'Custom iPhone Football Case',
    category: 'Phone Accessories',
    image: '📱',
    source: 'Instagram',
    sourceIcon: '📸',
    demand: 'Medium',
    score: 76,
    priceRange: '300–900 MKD',
    printCost: '40–90 MKD',
    weight: '30–60g',
    size: '15cm × 7cm',
    market: 'Macedonia / Balkans',
    difficulty: 'Medium',
    reason:
      'Football designs can sell well if customized by team/player. Better for targeted buyers.',
  },
  {
    id: 3,
    title: 'Kitchen Sponge Holder',
    category: 'Home / Kitchen',
    image: '🧽',
    source: 'Reddit',
    sourceIcon: '👽',
    demand: 'High',
    score: 88,
    priceRange: '150–400 MKD',
    printCost: '25–55 MKD',
    weight: '35–70g',
    size: '9cm × 6cm',
    market: 'Worldwide + Local',
    difficulty: 'Easy',
    reason:
      'Useful household item. Cheap to print and easy to sell in bundles or with custom colors.',
  },
];

export default function Home() {
  const [text, setText] = useState('');
  const [ideas, setIdeas] = useState(demoIdeas);
  const [selected, setSelected] = useState(demoIdeas[0]);
  const [loading, setLoading] = useState(false);

  async function analyzeDemand() {
    if (!text.trim()) return;

    setLoading(true);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const json = await res.json();

      if (json.data) {
        const newIdea = {
          id: Date.now(),
          title: json.data.product_name || 'New Product Idea',
          category: json.data.category || 'Product',
          image: '💡',
          source: 'Manual Input',
          sourceIcon: '✍️',
          demand:
            json.data.demand_score >= 4
              ? 'High'
              : json.data.demand_score >= 3
              ? 'Medium'
              : 'Low',
          score: (json.data.demand_score || 3) * 20,
          priceRange: `${json.data.expected_price_mkd || 300} MKD`,
          printCost: 'Estimate needed',
          weight: 'Estimate needed',
          size: 'Estimate needed',
          market: json.data.city || 'Macedonia',
          difficulty: json.data.difficulty || 'Medium',
          reason: json.data.reasoning || 'AI detected possible product demand.',
        };

        setIdeas([newIdea, ...ideas]);
        setSelected(newIdea);
        setText('');
      }
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  }

  return (
    <main style={styles.app}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>🖨️ PrintTrend</div>

        <div style={styles.menuTitle}>Market Intelligence</div>

        <div style={styles.menuActive}>💡 Product Ideas</div>
        <div
  style={styles.menuItem}
  onClick={async () => {
    try {
      const res = await fetch('/api/saved');
      const json = await res.json();

      if (json.success) {
        setIdeas(json.data);   // reuse your cards grid
        setSelected(null);     // reset right panel
      }
    } catch (err) {
      console.error(err);
      alert('Error loading saved ideas');
    }
  }}
>
  ⭐ Saved Ideas
</div>
        <div style={styles.menuItem}>🔎 Sources</div>
        <div style={styles.menuItem}>📊 Demand Scores</div>

        <div style={styles.sidebarBox}>
          <strong>{ideas.length}</strong>
          <span> ideas found</span>
        </div>
      </aside>

      <section style={styles.content}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>AI Product Ideas</h1>
            <p style={styles.subtitle}>
              Find products people already want before you waste time printing.
            </p>
          </div>

          <div style={styles.live}>● Private Mode</div>
        </header>

        <div style={styles.searchBox}>
          <textarea
            style={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a comment, post, or idea here... Example: A ka ne Shkup mbajtese telefoni per makine ma lire?"
          />

          <button style={styles.button} onClick={analyzeDemand}>
            {loading ? 'Analyzing...' : 'Analyze Demand'}
          </button>
        </div>

        <div style={styles.grid}>
          {ideas.map((idea) => (
            <button
              key={idea.id}
              style={{
                ...styles.card,
                border:
                  selected?.id === idea.id
                    ? '2px solid #22c55e'
                    : '1px solid #e5e7eb',
              }}
              onClick={() => setSelected(idea)}
            >
              <div style={styles.image}>{idea.image}</div>

              <div style={styles.cardBody}>
                <div style={styles.row}>
                  <span style={styles.category}>{idea.category}</span>
                  <span style={styles.score}>↗ {idea.score}</span>
                </div>

                <h2 style={styles.cardTitle}>{idea.title}</h2>

                <p style={styles.cardText}>{idea.reason}</p>

                <div style={styles.source}>
                  <span>{idea.sourceIcon}</span>
                  <span>Source: {idea.source}</span>
                </div>

                <div style={styles.cardStats}>
                  <div>
                    <small>Price</small>
                    <strong>{idea.priceRange}</strong>
                  </div>

                  <div>
                    <small>Demand</small>
                    <strong>{idea.demand}</strong>
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
            ×
          </button>

          <div style={styles.bigImage}>{selected.image}</div>

          <h2 style={styles.detailTitle}>{selected.title}</h2>
          <p style={styles.detailText}>{selected.reason}</p>

          <div style={styles.detailGrid}>
            <Info label="Demand" value={selected.demand} />
            <Info label="Score" value={`${selected.score}/100`} />
            <Info label="Selling price" value={selected.priceRange} />
            <Info label="Print cost" value={selected.printCost} />
            <Info label="Weight" value={selected.weight} />
            <Info label="Size" value={selected.size} />
            <Info label="Market" value={selected.market} />
            <Info label="Difficulty" value={selected.difficulty} />
          </div>

          <div style={styles.origin}>
            <strong>Idea source</strong>
            <p>
              {selected.sourceIcon} Found from: {selected.source}
            </p>
          </div>

          <button
  style={styles.saveButton}
  onClick={async () => {
    try {
      await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selected),
      });

      alert('Saved successfully');
    } catch (err) {
      console.error(err);
      alert('Error saving');
    }
  }}
>
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

const styles = {
  app: {
    minHeight: '100vh',
    display: 'grid',
    gridTemplateColumns: '240px 1fr 380px',
    background: '#f8fafc',
    color: '#0f172a',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  sidebar: {
    background: '#ffffff',
    borderRight: '1px solid #e5e7eb',
    padding: 22,
  },
  logo: {
    fontSize: 22,
    fontWeight: 800,
    marginBottom: 36,
    color: '#16a34a',
  },
  menuTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    color: '#64748b',
    fontWeight: 700,
    marginBottom: 14,
  },
  menuActive: {
    padding: '12px 14px',
    background: '#dcfce7',
    color: '#166534',
    borderRadius: 12,
    fontWeight: 700,
    marginBottom: 8,
  },
  menuItem: {
    padding: '12px 14px',
    color: '#475569',
    marginBottom: 6,
  },
  sidebarBox: {
    marginTop: 40,
    padding: 16,
    background: '#f1f5f9',
    borderRadius: 14,
  },
  content: {
    padding: 32,
    overflow: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 34,
    marginBottom: 6,
  },
  subtitle: {
    color: '#64748b',
  },
  live: {
    color: '#16a34a',
    fontWeight: 700,
  },
  searchBox: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 18,
    padding: 18,
    marginBottom: 28,
  },
  textarea: {
    width: '100%',
    minHeight: 110,
    border: '1px solid #d1d5db',
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    resize: 'vertical',
    outline: 'none',
  },
  button: {
    marginTop: 12,
    background: '#22c55e',
    border: 'none',
    color: '#052e16',
    padding: '12px 18px',
    borderRadius: 12,
    fontWeight: 800,
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))',
    gap: 22,
  },
  card: {
    background: '#ffffff',
    borderRadius: 18,
    overflow: 'hidden',
    textAlign: 'left',
    cursor: 'pointer',
    padding: 0,
  },
  image: {
    height: 150,
    display: 'grid',
    placeItems: 'center',
    fontSize: 70,
    background: '#f1f5f9',
  },
  cardBody: {
    padding: 18,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  category: {
    background: '#eef2ff',
    color: '#3730a3',
    padding: '5px 9px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
  },
  score: {
    color: '#16a34a',
    fontWeight: 800,
  },
  cardTitle: {
    fontSize: 20,
    marginBottom: 10,
  },
  cardText: {
    color: '#475569',
    lineHeight: 1.5,
    fontSize: 14,
    minHeight: 64,
  },
  source: {
    display: 'flex',
    gap: 8,
    color: '#64748b',
    fontSize: 13,
    marginTop: 14,
  },
  cardStats: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    marginTop: 16,
  },
  detailPanel: {
    background: '#ffffff',
    borderLeft: '1px solid #e5e7eb',
    padding: 24,
    position: 'relative',
    overflow: 'auto',
  },
  close: {
    position: 'absolute',
    top: 16,
    right: 16,
    border: 'none',
    background: '#f1f5f9',
    width: 34,
    height: 34,
    borderRadius: 10,
    fontSize: 22,
    cursor: 'pointer',
  },
  bigImage: {
    height: 180,
    display: 'grid',
    placeItems: 'center',
    fontSize: 90,
    background: '#f8fafc',
    borderRadius: 18,
    marginBottom: 18,
  },
  detailTitle: {
    fontSize: 26,
    marginBottom: 10,
  },
  detailText: {
    color: '#475569',
    lineHeight: 1.6,
    marginBottom: 18,
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  infoBox: {
    background: '#f8fafc',
    border: '1px solid #e5e7eb',
    borderRadius: 14,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  origin: {
    marginTop: 18,
    padding: 16,
    background: '#ecfdf5',
    borderRadius: 14,
    color: '#14532d',
  },
  saveButton: {
    marginTop: 18,
    width: '100%',
    padding: 14,
    borderRadius: 14,
    border: 'none',
    background: '#0f172a',
    color: '#ffffff',
    fontWeight: 800,
    cursor: 'pointer',
  },
};