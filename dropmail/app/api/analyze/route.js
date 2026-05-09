import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const { text } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Missing OPENAI_API_KEY' },
        { status: 500 }
      );
    }

    const response = await client.responses.create({
      model: 'gpt-5.5',
      input: `
You are Printora Radar, an AI that finds 3D-printable product ideas from social media comments.

Analyze this text:
"${text}"

Return ONLY valid JSON with this shape:
{
  "product_name": "",
  "category": "",
  "demand_score": 1,
  "can_3d_print": true,
  "expected_price_mkd": 0,
  "difficulty": "",
  "profit_potential": "",
  "city": "",
  "reasoning": ""
}
      `,
    });

    const raw = response.output_text;
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const data = JSON.parse(cleaned);

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Analyze error:', err);

    return NextResponse.json(
      { error: 'AI analysis failed' },
      { status: 500 }
    );
  }
}