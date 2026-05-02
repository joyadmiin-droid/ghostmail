'use client';

import { useState } from 'react';

export default function Home() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function handleAnalyze() {
    if (!text) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      setResult(data.data);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  }

  return (
    <main style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>
        PrintTrend AI
      </h1>

      <p style={{ marginBottom: '30px', color: '#666' }}>
        Find what people actually want. Build it. Sell it.
      </p>

      <textarea
        placeholder="Type something like: A ka ne Shkup maska per iPhone 13..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{
          width: '100%',
          height: '120px',
          padding: '10px',
          marginBottom: '20px',
        }}
      />

      <button
        onClick={handleAnalyze}
        style={{
          padding: '10px 20px',
          background: 'black',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {loading ? 'Analyzing...' : 'Analyze Demand'}
      </button>

      {result && (
        <div style={{ marginTop: '30px' }}>
          <h3>Result:</h3>

          <pre
            style={{
              background: '#111',
              color: '#0f0',
              padding: '15px',
              borderRadius: '8px',
              overflow: 'auto',
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </main>
  );
}