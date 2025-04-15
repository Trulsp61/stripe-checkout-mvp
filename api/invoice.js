// api/invoice.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, company, orgNumber, purchaserName, tier } = req.body;

  const priceMap = {
    low: 'price_1REAkVAl3xtbZVsPWiEbMPMh',
    mid: 'price_1REAnpAl3xtbZVsPZuEMeanK',
    high: 'price_1REAnpAl3xtbZVsPWCHWalWg',
  };

  const priceId = priceMap[tier] || priceMap.mid;

  try {
    // 1. Create customer with metadata
    const customer = await stripe.customers.create({
      email,
      name: company,
      metadata: {
        org_number: orgNumber,
        purchaser_name: purchaserName,
        campaign: 'smb-early',
      },
    });

    // 2. Create subscription with send_invoice method
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      collection_method: 'send_invoice',
      days_until_due: 14, // Adjust due period as needed
      payment_settings: {
        payment_method_types: ['card', 'bank_transfer'],
      },
      metadata: {
        org_number: orgNumber,
        purchaser_name: purchaserName,
        campaign: 'smb-early',
      },
    });

    res.status(200).json({ status: 'invoice_created', customerId: customer.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}