import OpenAI from 'openai';
import { NextResponse } from 'next/server';

function conceptPrompt(idea) {
  return `
Simple product concept render for a 3D printable object.
Product: ${idea.title}
Purpose: ${idea.printableSolution || idea.customerProblem || idea.reason}
Material: ${idea.material || 'PLA or PETG'}
Style: clean practical product photo, white background, no text, no logo, no hands, show the part clearly, useful functional design.
  `.trim();
}

export async function POST(req) {
  try {
    const { idea } = await req.json();

    if (!idea?.title) {
      return NextResponse.json({ error: 'Missing idea' }, { status: 400 });
    }

    const prompt = conceptPrompt(idea);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: true,
        data: { prompt, image: '' },
      });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const image = await client.images.generate({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
    });

    const b64 = image.data?.[0]?.b64_json;

    return NextResponse.json({
      success: true,
      data: {
        prompt,
        image: b64 ? `data:image/png;base64,${b64}` : '',
      },
    });
  } catch (err) {
    console.error('Concept error:', err);
    return NextResponse.json(
      { error: 'Concept generation failed' },
      { status: 500 }
    );
  }
}
