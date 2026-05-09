import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const DEMAND_PHRASES = [
  'i need',
  'i wish there was',
  'i hate when',
  'any solution for',
  'where can i buy',
  'i struggle with',
  'does anyone know',
  'looking for',
  'recommend me',
  'need a replacement',
  'broke',
  'keeps falling',
  'does not fit',
  'holder for',
  'adapter for',
  'mount for',
  'clip for',
];

function findSignals(text) {
  const lower = text.toLowerCase();
  return DEMAND_PHRASES.filter((phrase) => lower.includes(phrase));
}

function safeJson(raw) {
  const cleaned = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1) {
    throw new Error('No JSON object returned');
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function POST(req) {
  try {
    const { text, source = 'Manual scan', niche = '3D printed products' } =
      await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Missing OPENAI_API_KEY' },
        { status: 500 }
      );
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const localSignals = findSignals(text);

    const response = await client.responses.create({
      model: 'gpt-5.5',
      input: `
You are PrintTrend Radar, an AI product researcher for a small 3D printing business.

Goal:
Find real product demand inside posts, comments, reviews, and forum text. The best ideas are small physical objects that can be 3D printed and sold locally or online: replacement parts, clips, brackets, adapters, holders, mounts, covers, knobs, spacers, organizers, bathroom/kitchen fixes, appliance parts, hobby parts, and machine accessories.

Scan for buying/problem phrases such as:
"I need", "I wish there was", "I hate when", "any solution for", "where can I buy", "I struggle with", "does anyone know", "looking for", "recommend me", "need a replacement", "broke", "keeps falling", "does not fit", "holder for", "adapter for", "mount for", "clip for".

Rules:
- Return only ideas that are realistic to 3D print.
- Group similar comments into the same product opportunity whenever possible.
- Use a specific product name, not a vague category. Example: "Dishwasher Rack Wheel Replacement", not "Kitchen Part".
- Ignore software, food, clothing, services, medical devices, weapons, copyrighted character products, and items that need certified safety testing.
- Prefer boring useful parts over novelty items.
- If the text contains no good 3D-printable demand, return an empty ideas array and explain why in summary.
- Use Macedonian denar pricing when estimating.
- Demand score is 1-100 and should reward repeated mentions, pain/urgency, clear buyer intent, small size, low print cost, and poor availability.

Source: ${source}
Niche: ${niche}
Signals found by keyword scan: ${localSignals.join(', ') || 'none'}

Text to analyze:
${text}

Return ONLY valid JSON with this exact shape:
{
  "summary": "",
  "signals_found": [],
  "ideas": [
    {
      "product_name": "",
      "category": "",
      "demand_score": 1,
      "confidence": "Low",
      "can_3d_print": true,
      "trigger_phrase": "",
      "problem_quote": "",
      "customer_problem": "",
      "printable_solution": "",
      "expected_price_mkd": "150-400 MKD",
      "estimated_print_cost_mkd": "25-80 MKD",
      "estimated_weight": "30-70g",
      "estimated_size": "8cm x 5cm",
      "market": "",
      "difficulty": "Easy",
      "profit_potential": "Medium",
      "why_it_can_sell": "",
      "material": "PETG",
      "risk_level": "Low",
      "risk_reason": "",
      "print_time_estimate": "1-2 hours",
      "competition_level": "Medium",
      "repeat_buyer_potential": "Low",
      "score_breakdown": {
        "demand": 1,
        "print_difficulty": 1,
        "profit": 1,
        "competition": 1,
        "shipping": 1,
        "repeat_buyers": 1
      },
      "validation_keywords": [],
      "validation_tasks": [],
      "prototype_steps": [],
      "measurements_needed": [],
      "cad_brief": "",
      "listing_title": "",
      "listing_description": "",
      "status": "Found",
      "evidence_count": 1,
      "merged_phrases": []
    }
  ]
}
      `,
    });

    const data = safeJson(response.output_text);

    return NextResponse.json({
      success: true,
      data: {
        summary: data.summary || '',
        signals_found: Array.isArray(data.signals_found)
          ? data.signals_found
          : localSignals,
        ideas: Array.isArray(data.ideas) ? data.ideas : [],
      },
    });
  } catch (err) {
    console.error('Analyze error:', err);

    return NextResponse.json(
      { error: 'AI analysis failed' },
      { status: 500 }
    );
  }
}
