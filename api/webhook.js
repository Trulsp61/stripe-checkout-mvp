// api/webhook.js
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Stripe from 'stripe';
import { buffer } from 'micro';
import fetch from 'node-fetch';

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// 🧩 Slack posting helper
async function postToSlack(obj, metadata) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('⚠️ No Slack webhook URL defined');
    return;
  }

  const message = `
👤 *Navn:* ${metadata.purchaser_name || 'Ukjent'}
📧 *E-post:* ${metadata.purchaser_email || 'Ukjent'}
🏢 *Bedrift:* ${metadata.company_name || 'Ukjent'}
🏷️ **Org.nr:** ${metadata.org_number || 'Ukjent'}
💳 *Betaling:* ${metadata.payment_method || obj.payment_method_types?.[0] || 'Ukjent'}

🛠️ *Handling:* Bruk Cardboard og promokode for å opprette "Bedrift 10 lisenser"
`;

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `@channel\n🎉 *Nytt kjøp!* Hvem kan følge opp?\n\n${message}`,
      }),
    });

    if (!res.ok) {
      console.error('❌ Failed to post to Slack:', await res.text());
    }
  } catch (err) {
    console.error('❌ Slack webhook error:', err.message);
  }
}

// ✅ Webhook handler
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Error verifying webhook signature:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const eventType = event.type;
  const obj = event.data.object;

  switch (eventType) {
    case 'invoice.sent': {
      console.log('📨 Stripe har sendt faktura til kunden:', obj.customer_email);

      let metadata = {};

      try {
        const customer = await stripe.customers.retrieve(obj.customer);
        metadata = customer.metadata || {};
      } catch (err) {
        console.warn('⚠️ Kunne ikke hente kunde-metadata:', err.message);
      }

      await postToSlack(obj, metadata);
      break;
    }

    case 'checkout.session.completed': {
      console.log('✅ Checkout fullført:', obj.id);

      let metadata = {};

      try {
        if (obj.customer) {
          const customer = await stripe.customers.retrieve(obj.customer);
          metadata = customer.metadata || {};
        } else {
          console.warn('⚠️ Ingen customer-ID i checkout.session.completed');
          metadata = obj.metadata || {};
        }
      } catch (err) {
        console.warn('⚠️ Klarte ikke hente metadata fra kunden:', err.message);
        metadata = obj.metadata || {};
      }

      console.log('📦 Metadata hentet i checkout.session.completed:', metadata);
      await postToSlack(obj, metadata);
      break;
    }

    default:
      console.log(`Unhandled event type: ${eventType}`);
  }

  res.json({ received: true });
}