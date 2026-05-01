import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Missing OPENAI_API_KEY' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `
You analyze social media text from Macedonia and extract product demand.

Return ONLY JSON with:
{
  "product_name": "",
  "category": "",
  "city": "",
  "language": "",
  "price_tier": "cheap | mid | premium",
  "expected_price_mkd": number,
  "demand_score": 1-5,
  "can_3d_print": true/false,
  "difficulty": "easy | medium | hard",
  "profit_potential": "low | medium | high",
  "reasoning": ""
}
          `,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.2,
    });

    const aiText = completion.choices[0].message.content;

    let data;

    try {
      data = JSON.parse(aiText);
    } catch (err) {
      return NextResponse.json({
        error: 'AI response not valid JSON',
        raw: aiText,
      });
    }

    const { error } = await supabase.from('market_signals').insert([
      {
        raw_text: text,
        product_name: data.product_name,
        category: data.category,
        city: data.city,
        language: data.language,
        price_tier: data.price_tier,
        expected_price_mkd: data.expected_price_mkd,
        demand_score: data.demand_score,
        can_3d_print: data.can_3d_print,
        difficulty: data.difficulty,
        profit_potential: data.profit_potential,
        reasoning: data.reasoning,
      },
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}