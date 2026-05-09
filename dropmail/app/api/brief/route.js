import OpenAI from 'openai';
import { NextResponse } from 'next/server';

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
    const { idea } = await req.json();

    if (!idea?.title) {
      return NextResponse.json({ error: 'Missing idea' }, { status: 400 });
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

    const response = await client.responses.create({
      model: 'gpt-5.5',
      input: `
Create a practical prototype brief for this 3D printing product idea.

Idea:
${JSON.stringify(idea, null, 2)}

Return ONLY valid JSON:
{
  "cad_brief": "",
  "prototype_steps": [],
  "measurements_needed": [],
  "print_settings": [],
  "material": "",
  "risk_level": "",
  "risk_reason": "",
  "listing_title": "",
  "listing_description": "",
  "first_test_plan": []
}
      `,
    });

    return NextResponse.json({ success: true, data: safeJson(response.output_text) });
  } catch (err) {
    console.error('Brief error:', err);
    return NextResponse.json(
      { error: 'Prototype brief failed' },
      { status: 500 }
    );
  }
}
