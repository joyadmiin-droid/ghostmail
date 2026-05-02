'use client';

import { useState } from 'react';

export default function Home() {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);

  const analyze = async () => {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();

    if (data.data) {
      setResult(data.data);
    }
  };

  return (
    <main className="container">
      <h1 className="title">PrintTrend AI</h1>
      <p className="subtitle">
        Find what people actually want. Build it. Sell it.
      </p>

      <textarea
        className="textarea"
        placeholder="Example: Dua nje mbajtese telefoni per makine..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <button className="button" onClick={analyze}>
        Analyze Demand
      </button>

      {result && (
        <div className="card">
          <h2>{result.product_name}</h2>
          <p>{result.reasoning}</p>

          <div style={{ marginTop: 10 }}>
            <span className={`badge ${result.demand_score >= 4 ? 'high' : 'medium'}`}>
              Demand: {result.demand_score}/5
            </span>

            <span className="badge">
              {result.price_tier}
            </span>

            <span className="badge">
              {result.expected_price_mkd} MKD
            </span>

            <span className="badge">
              {result.difficulty}
            </span>
          </div>
        </div>
      )}
    </main>
  );
}