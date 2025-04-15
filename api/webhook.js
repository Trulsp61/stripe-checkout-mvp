// api/webhook.js
import Stripe from 'stripe';
import { buffer } from 'micro';

export const config = {
  api: {
    bodyParser: false, // Required for raw Stripe signature verification
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

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

  // ✅ Handle relevant events
  switch (event.type) {
    case 'invoice.created':
      console.log('🧾 Invoice created:', event.data.object.id);
      // TODO: Grant temporary access to the platform here
      break;

    case 'invoice.paid':
      console.log('✅ Invoice paid:', event.data.object.id);
      // TODO: Confirm permanent access
      break;

    case 'invoice.payment_failed':
      console.log('❌ Payment failed:', event.data.object.id);
      // TODO: Revoke access
      break;

    case 'customer.subscription.deleted':
      console.log('❌ Subscription cancelled:', event.data.object.id);
      // TODO: Revoke access
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
}