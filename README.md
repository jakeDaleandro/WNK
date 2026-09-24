# Waste Not Kitchen

Waste Not Kitchen connects restaurants that have surplus food with the people who'll eat it:

| Account type | What they do |
| --- | --- |
| **Restaurant** | Lists surplus plates with a price and a pickup-by time, then verifies each pickup with a code |
| **Customer** | Reserves discounted plates and picks them up with a one-time code |
| **Donor** | Buys plates that become free meals for the community, and gets a year-end tax receipt |
| **Community member** | Claims donated meals for free (up to 2 at a time) |
| **Administrator** | Manages members, sees platform analytics, and generates PDF reports |

Originally a COP4710 PHP/MySQL project. Version 2 is a rebuild on Firebase.

## Stack

- **Web:** React 19, TypeScript, Vite, Tailwind CSS v4, Recharts, jsPDF
- **Backend:** Firebase Auth, Cloud Firestore, Cloud Functions (Node 22, 2nd gen), Firebase Hosting
- **Project:** `wnkk-9486c`

```
src/            web app (pages, components, PDF report engine)
functions/      Cloud Functions: ordering, claims, pickup verification, admin, housekeeping
firestore.rules security rules
tests/          rules tests + end-to-end function tests (run on the emulators)
scripts/        demo-data seeder and admin bootstrap
```

## Security model

- **Clients never write money, inventory, or pickup state.** Orders, donated meals and impact stats can only be written
  by Cloud Functions, inside Firestore transactions. This makes overselling, double-claiming and self-confirming a
  pickup impossible.
- **Firestore rules** check the caller's role and account status on every read and write. Plates are validated field by
  field. Profiles can't change their own role or status, and admin can't be self-assigned.
- **Pickup codes:** each reservation or claimed meal gets a random 6-character code. Only the restaurant that owns the
  order can redeem it.
- **Suspension** disables sign-in, revokes sessions, and is also enforced in the rules.
- **Payments are simulated.** Card numbers are validated in the browser (Luhn check + expiry). Only brand, last four
  digits and expiry are stored, and the rules reject anything else.
- Hosting sends HSTS, `X-Frame-Options: DENY`, `nosniff` and a strict referrer policy.

## Development

Requires Node 22+ and **Java 21+** (for the Firebase emulators).

```bash
npm install && npm --prefix functions install

# terminal 1: local Firebase (Auth, Firestore, Functions, UI at http://localhost:4000)
npm --prefix functions run build && npm run emulators

# terminal 2: demo data (60 days of history), then the app pointed at the emulators
npm run seed
VITE_USE_EMULATORS=true npm run dev
```

Seeded accounts all use the password `password123`: `admin@`, `pasta@`, `bakery@`, `customer@`, `donor@`,
`needy@wnk.test` (and a few more).

### Tests

```bash
npm run test:rules       # 20+ security-rule cases (privilege escalation, forged orders, card data, ...)
npm run test:functions   # ordering, overselling under concurrency, claims limit, pickups, suspension
```

## Deploying

```bash
npm run deploy           # builds the web app + functions, deploys hosting, rules, indexes and functions
```

**First admin:** register in the app, then promote that account:

```bash
gcloud auth application-default login     # once
node scripts/grant-admin.mjs you@example.com
```

## Reports

Admins can generate these PDFs from **Reports** (with a preview option):

- **Platform impact:** KPIs, meals rescued over time, top restaurants, what happened to donated meals, restaurant
  leaderboard, membership
- **Restaurant statement:** annual revenue by month, performance by item, monthly summary
- **Customer history:** spending, savings, and itemized orders
- **Donor tax receipt:** itemized contributions and meals delivered
- **Community member summary:** meals received

Donors can download their own tax receipt, and customers and community members can export their own history.
