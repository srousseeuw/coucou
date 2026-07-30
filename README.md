# Coucou — kinderzonnebril webshop

Een winkel die één zonnebril verkoopt voor **€ 40 incl. btw** (exclusief
verzending), met betaling via Stripe en verzending **enkel binnen België**.

## Structuur

```
coucou/
├─ site/                 ← je website (upload naar Cloudflare Pages of Netlify)
│  ├─ index.html         ← winkel + afrekenpagina
│  └─ bedankt.html       ← bedankpagina na geslaagde betaling
├─ worker/               ← de betaal-server (één worker voor de hele site)
│  ├─ worker.js          ← maakt de Stripe Checkout-sessie
│  └─ wrangler.toml      ← worker-configuratie
├─ .gitignore
└─ README.md
```

**Belangrijk:** één worker volstaat voor de hele winkel — je maakt er géén
per pagina. De HTML-pagina's zijn je website; de worker is het betaal-loket
waar ze allemaal naar verwijzen.

## Waarom twee stukken?

Een echte kaartbetaling vereist je Stripe *geheime* sleutel (`sk_...`). Die mag
**nooit** in de HTML of in GitHub staan — iedereen kan die code lezen. De sleutel
woont daarom alleen als versleutelde *secret* bij Cloudflare. In deze repo staat
hij nergens, dus je kunt alles veilig naar GitHub pushen (ook een publieke repo).

---

## Stap 1 — Alles naar GitHub

Upload de hele `coucou/`-map naar een nieuwe GitHub-repository (via de
"Add file → Upload files"-knop op github.com, of met git).

## Stap 2 — De worker deployen

**Optie A — via de browser (geen installatie):**
1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker**
2. Naam: `coucou-checkout` → **Deploy** → **Edit code**
3. Plak de inhoud van `worker/worker.js`, pas de 3 regels bovenaan aan → **Deploy**
4. **Settings → Variables and Secrets → Add → Secret**
   - Naam: `STRIPE_SECRET_KEY`  ·  Waarde: je Stripe-sleutel  → **Save**

**Optie B — via GitHub-koppeling:**
1. **Workers & Pages → Create → Workers → Connect to Git**
2. Kies je repo, root directory: `worker/`
3. Voeg de secret `STRIPE_SECRET_KEY` toe bij **Settings**

Je krijgt een URL zoals `https://coucou-checkout.jouwnaam.workers.dev`.

## Stap 3 — De website online zetten

**Cloudflare Pages:** **Workers & Pages → Create → Pages → Connect to Git**,
root directory `site/`. (Of sleep de `site/`-bestanden bij **Upload assets**.)

**Netlify Drop:** sleep de bestanden uit `site/` naar https://app.netlify.com/drop

## Stap 4 — Koppelen

In `site/index.html`, zoek bovenaan het script:

```js
var CHECKOUT_ENDPOINT = "";
```

Zet daar je worker-URL:

```js
var CHECKOUT_ENDPOINT = "https://coucou-checkout.jouwnaam.workers.dev";
```

Pas in `worker/worker.js` ook de bovenste drie regels aan naar je echte
site-adres (`ALLOWED_ORIGIN`, `SUCCESS_URL`, `CANCEL_URL`) en deploy opnieuw.

## Stap 5 — Testen

Gebruik in Stripe-testmodus deze kaart:

```
4242 4242 4242 4242   ·   datum: elke toekomstige   ·   CVC: elk 3-cijferig
```

Werkt alles? Vervang je `sk_test_...` door je `sk_live_...` sleutel en deploy
de worker opnieuw.

---

## Aanpassen

- **Prijs:** `PRICE_CENTS` in `worker.js` (4000 = € 40,00). Pas ook de
  zichtbare prijs in `index.html` aan.
- **Verzendkosten:** `SHIPPING_OPTIONS` in `worker.js` (bedragen in centen).
- **Bestellingen bekijken:** Stripe-dashboard → **Payments**. Het adres staat
  in de metadata van elke betaling.
