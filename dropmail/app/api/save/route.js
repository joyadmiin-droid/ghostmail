import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const idea = await req.json();
    const rawData = {
      ...idea,
      saved_version: 2,
      saved_at_client: new Date().toISOString(),
      workflow: {
        status: idea.status,
        reject_reason: idea.rejectReason,
        notes: idea.notes,
        checked_tasks: idea.checkedTasks || [],
      },
      listing: {
        title: idea.listingTitle,
        description: idea.listingDescription,
      },
      validation: {
        tasks: idea.validationTasks || [],
        keywords: idea.keywords || [],
      },
      concept: {
        prompt: idea.conceptPrompt,
        image: idea.conceptImage,
      },
    };

    const { error } = await supabase.from('saved_ideas').insert([
      {
        title: idea.title,
        category: idea.category,
        source: idea.source,
        source_icon: idea.sourceIcon,
        demand: idea.demand,
        score: idea.score,
        price_range: idea.priceRange,
        print_cost: idea.printCost,
        weight: idea.weight,
        size: idea.size,
        market: idea.market,
        difficulty: idea.difficulty,
        reason: idea.rejectReason
          ? `${idea.reason} Rejected: ${idea.rejectReason}`
          : idea.reason,
        raw_data: rawData,
      },
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
