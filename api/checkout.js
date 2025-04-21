// api/checkout.js
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 🔗 Dynamisk base-URL for suksess/avbrutt redirect
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    email,
    name,
    company,
    orgnr,
    tier,
    payment_method,
  } = req.body;

  console.log("💳 Selected payment method:", payment_method);

  const priceMap = {
    low: 'price_1RETjmPGVR57I7gr0BqQFILz',
    mid: 'price_1RETjmPGVR57I7grGiRX3TEg',
    high: 'price_1RETgZPGVR57I7greWUc4DyJ',
  };

  const priceId = priceMap[tier] || priceMap.mid;

  try {
    if (payment_method === 'invoice') {
      // ✅ Opprett kunde
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          purchaser_name: name,
          purchaser_email: email,
          company_name: company,
          org_number: orgnr,
          payment_method: 'Faktura',
        },
      });

      // ✅ Opprett invoice item
      const invoiceItem = await stripe.invoiceItems.create({
        customer: customer.id,
        price: priceId,
      });

      console.log("🧾 Invoice item created:", invoiceItem.id);

      // ✅ (valgfritt delay for sandbox-stabilitet)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // ✅ Opprett og send faktura med auto_advance
      const invoice = await stripe.invoices.create({
        customer: customer.id,
        collection_method: 'send_invoice',
        days_until_due: 14,
        auto_advance: true,
        pending_invoice_items_behavior: 'include',
        description: 'Spørsmål? Kontakt oss på hjelp@videocation.no\nVi svarer innen 24 timer på virkedager.',
        footer: 'Takk for at du velger Videocation som din kompetansepartner.',
        metadata: {
          purchaser_name: name,
          purchaser_email: email,
          company_name: company,
          org_number: orgnr,
          payment_method: 'Faktura',
        },
      });

      console.log("📬 Invoice created:", invoice.id);

      return res.status(200).json({ url: `${BASE_URL}/takk-for-bestilling.html` });
    }

    // ✅ Kortbetaling via Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: email,
      success_url: `${BASE_URL}/takk-for-bestilling.html`,
      cancel_url: `${BASE_URL}/cancel.html`,
      metadata: {
        purchaser_name: name,
        purchaser_email: email,
        company_name: company,
        org_number: orgnr,
        payment_method: 'Kort',
      },
      custom_fields: [
        {
          key: 'company_name',
          label: { type: 'custom', custom: 'Bedriftens navn' },
          type: 'text',
        },
      ],
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('❌ Stripe error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}