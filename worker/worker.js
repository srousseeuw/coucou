// =============================================================================
// Coucou — Stripe Checkout backend (Cloudflare Worker)
// -----------------------------------------------------------------------------
// This creates a Stripe Checkout Session for one €40 sunglass, restricts
// shipping to Belgium, and adds shipping-cost options. The customer is then
// redirected to Stripe's secure hosted payment page.
//
// Your Stripe SECRET key lives here as an encrypted secret — never in the HTML.
//
// SETUP (see the instructions file for full steps):
//   1. npm install -g wrangler   &&   wrangler login
//   2. wrangler secret put STRIPE_SECRET_KEY      (paste your sk_live_... or sk_test_...)
//   3. Edit ALLOWED_ORIGIN + SUCCESS_URL + CANCEL_URL below.
//   4. wrangler deploy
//   5. Put the deployed URL into CHECKOUT_ENDPOINT in index.html
// =============================================================================

// The domain where index.html is hosted (for CORS + redirect URLs).
// Use "*" only while testing locally.
const ALLOWED_ORIGIN = "https://coucou.ocior.be/";        // <-- change me
const SUCCESS_URL     = "https://coucou.ocior.be/bedankt.html"; // <-- change me
const CANCEL_URL      = "https://coucou.ocior.be/index.html";   // <-- change me

// Price in cents, incl. VAT. €40.00 = 4000.
const PRICE_CENTS = 4000;

// Shipping options shown at checkout (name + cost in cents). Adjust to taste.
const SHIPPING_OPTIONS = [
  { label: "Standaard verzending (2–4 werkdagen)", amountCents: 495 },
  { label: "Verzending morgen (bestel voor 15u)",  amountCents: 895 },
];

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, cors);
    }

    if (!env.STRIPE_SECRET_KEY) {
      return json({ error: "Server niet geconfigureerd (STRIPE_SECRET_KEY ontbreekt)." }, 500, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Ongeldige aanvraag." }, 400, cors);
    }

    // Basic server-side validation. Never trust the browser.
    const email  = String(body.email || "").trim();
    const postal = String(body.postal || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Ongeldig e-mailadres." }, 400, cors);
    }
    if (!/^\d{4}$/.test(postal)) {
      return json({ error: "Ongeldige Belgische postcode." }, 400, cors);
    }

    // Aantal brillen: veilig afdwingen tussen 1 en 10 (nooit de browser vertrouwen).
    let quantity = parseInt(body.quantity, 10);
    if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
    if (quantity > 10) quantity = 10;

    // Build the Stripe Checkout Session as URL-encoded form data.
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", SUCCESS_URL + "?session_id={CHECKOUT_SESSION_ID}");
    params.append("cancel_url", CANCEL_URL);
    params.append("customer_email", email);

    // The single product line item.
    params.append("line_items[0][quantity]", String(quantity));
    params.append("line_items[0][price_data][currency]", "eur");
    params.append("line_items[0][price_data][unit_amount]", String(PRICE_CENTS));
    params.append("line_items[0][price_data][product_data][name]", "Coucou kinderzonnebril");
    params.append("line_items[0][price_data][product_data][description]", "UV400 · incl. brillenkoord en hoesje");

    // Ship to Belgium ONLY. Stripe blocks any other country at checkout.
    params.append("shipping_address_collection[allowed_countries][0]", "BE");

    // Shipping rate options.
    SHIPPING_OPTIONS.forEach((opt, i) => {
      params.append(`shipping_options[${i}][shipping_rate_data][type]`, "fixed_amount");
      params.append(`shipping_options[${i}][shipping_rate_data][display_name]`, opt.label);
      params.append(`shipping_options[${i}][shipping_rate_data][fixed_amount][amount]`, String(opt.amountCents));
      params.append(`shipping_options[${i}][shipping_rate_data][fixed_amount][currency]`, "eur");
    });

    // Keep the customer's typed address on the order for your records.
    params.append("metadata[naam]", String(body.name || ""));
    params.append("metadata[adres]", String(body.address || ""));
    params.append("metadata[postcode]", postal);
    params.append("metadata[gemeente]", String(body.city || ""));

    const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env.STRIPE_SECRET_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return json({ error: (data.error && data.error.message) || "Stripe-fout." }, 502, cors);
    }

    return json({ url: data.url }, 200, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
