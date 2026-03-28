import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const eventType = body?.event_type;
    const data = body?.data;

    console.log('Paddle webhook received:', eventType);

    // Subscription activated or updated
    if (
      eventType === 'subscription.activated' ||
      eventType === 'subscription.updated'
    ) {
      const customData = data?.custom_data || {};
      const plan = customData?.plan;
      const userEmail = data?.customer?.email;

      if (!userEmail || !plan) {
        console.error('Missing email or plan in webhook', { userEmail, plan });
        return Response.json({ received: true });
      }

      // Find the user by email and update their plan
      const { data: profile, error: findError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', userEmail)
        .single();

      if (findError || !profile) {
        console.error('User not found for email:', userEmail);
        return Response.json({ received: true });
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ plan: plan })
        .eq('id', profile.id);

      if (updateError) {
        console.error('Failed to update plan:', updateError);
      } else {
        console.log('Plan updated to', plan, 'for', userEmail);
      }
    }

    // Subscription cancelled
    if (eventType === 'subscription.canceled') {
      const userEmail = data?.customer?.email;

      if (userEmail) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', userEmail)
          .single();

        if (profile) {
          await supabase
            .from('profiles')
            .update({ plan: 'free' })
            .eq('id', profile.id);

          console.log('Plan reset to free for', userEmail);
        }
      }
    }

    return Response.json({ received: true });   
  } catch (err) {
    console.error('Webhook error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
