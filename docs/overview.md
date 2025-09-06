# Overview

## Purpose

- **Sojourns** is a luxury travel itinerary app that empowers travel agents to create, manage, and share beautiful itineraries with their clients
- Agents can upload documents, leverage generative AI to rapidly draft itineraries, and deliver a premium experience to their clients.
- Clients (luxury travelers) get a fast, beautiful, polished iOS app to easily review, manage, and add to their trip details.

---

## Target Users

- **Luxury travel agents**
  - Efficiently create professional itineraries in minutes.
  - Upload PDFs, confirmations, and bookings, then leverage generative AI to transform unstructured inputs into curated itineraries.
  - Share itineraries via iOS app and PDF

- **Luxury travelers**
  - Access their trip plans through a beautifully designed iOS app.
  - Add co-travelers, personal activities.
  - Use AI to ask contextual questions (e.g., “What’s the weather during my Amalfi stay?”).

---

## Problem & Value

- **Problem:**
  - Existing agent tools are clunky, dated, and slow to use.
  - Traveler-facing experiences are basic (PDFs, plain portals) and lack the polish expected by luxury customers.

- **Value:**
  - Agents save hours per itinerary using automation and AI.
  - Clients get a modern, luxury-grade experience that builds loyalty.
  - Differentiates agencies by offering a branded, premium digital touchpoint.

---

## Success Metrics

- **Agent adoption:** Number of agencies actively building itineraries with Sojourns.
- **Client engagement:** % of clients opening itineraries in the app vs. PDF only.
- **Efficiency gains:** Reduction in average time for agents to create a full itinerary.
- **Output quality:** Accuracy/consistency of AI-generated itineraries (manual edits required).
- **Revenue impact:** Subscription revenue from agents; retention of early adopters.
- **System health:** Latency of AI itinerary generation, PDF exports, and mobile sync.

---

## Scope & Non-Goals

- **In scope:**
  - Web-based admin for agents to upload PDFs, create & manage itineraries, and share them with clients.
  - iOS app for travelers to view itineraries, invite other travelers, and add personal plans.
  - Generative AI workflows to accelerate itinerary creation.
  - PDF generation for shareable offline itineraries.
  - Billing model: per-seat or per-organization subscription via Stripe.
  - GDS/airline integrations to ensure live flight info
  - Simple book next trip action that contacts agent from home screen

- **Non-goals:**
  - Android client app (future consideration).
  - Receive real-time updates from their agent GDS/airline integrations (initially handled via manual upload).
  - Direct booking or payments through Sojourns.
  - Deep CRM/marketing automation features.

---

## Constraints

- **Tech stack:**
  - All-JS approach: Next.js (Vercel) + React Native (Expo)
  - Database: Neon Postgres with Drizzle ORM.
  - Auth & org management: Clerk.
  - Billing: Stripe Billing.
  - Storage: Cloudflare R2 (S3-compatible).
  - Background jobs: BullMQ + Upstash Redis; scheduled tasks via Vercel Cron.
  - AI: Vercel AI SDK with OpenAI/Anthropic.
  - PDFs: @react-pdf/renderer (upgrade to Playwright if pixel-perfect HTML → PDF needed).
  - Email: Postmark or Resend.

- **Operational:**
  - Small team; must minimize ops overhead.
  - Early MVP should favor hosted SaaS components (Clerk, Stripe, Neon, R2) to avoid infrastructure buildout.
  - Focus on rapid iteration with preview environments + Neon branches per PR.

- **Regulatory:**
  - Handle PII securely (traveler names, emails).
  - Ensure GDPR compliance for EU travelers.
  - PCI compliance outsourced to Stripe.

---

## Production Deployment Checklist

### Environment Setup

- [ ] **Neon Database:** Create main branch for production
- [ ] **Clerk:** Create production application instance
- [ ] **Vercel:** Configure production environment variables:
  - `DATABASE_URL` → Production Neon connection string
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` → Production Clerk key
  - `CLERK_SECRET_KEY` → Production Clerk secret
  - `CLERK_WEBHOOK_SECRET` → Production webhook secret

### Webhook Configuration

- [ ] **Clerk Webhooks:** Configure production webhooks
  - Endpoint: `https://your-domain.com/api/webhooks/clerk`
  - Events: `user.*`, `organization.*`, `organizationMembership.*`
  - Copy webhook secret to environment variables
- [ ] **Database Migration:** Run initial schema migration on production
- [ ] **Initial Data Sync:** Use `/api/sync-clerk` for existing Clerk data

### Security & Monitoring

- [ ] **Environment Variables:** Verify all secrets are production-ready
- [ ] **Database Access:** Ensure production DB is properly secured
- [ ] **Webhook Security:** Verify signature validation is working
- [ ] **Error Monitoring:** Set up logging for webhook events

### Testing

- [ ] **Manual Tests:** Test user/org creation, updates, deletions in Clerk
- [ ] **Database Sync:** Verify changes appear in production database
- [ ] **Rollback Plan:** Document how to disable webhooks if needed

---

## Development & Maintenance

### Test Account Cleanup

Regular cleanup of test accounts is important to maintain clean development environments and avoid hitting Clerk limits.

**Manual Cleanup Scripts:**

```bash
# Preview what would be deleted
cd scripts && npx tsx cleanup-test-accounts.ts --dry-run

# Delete test accounts from Clerk
cd scripts && npx tsx cleanup-test-accounts.ts

# Clean orphaned database records
cd scripts && npx tsx cleanup-database.ts --dry-run
cd scripts && npx tsx cleanup-database.ts
```

**Automated Cleanup:**

- GitHub Action runs weekly (Sundays 2 AM UTC)
- Manual trigger available in Actions tab
- Always defaults to dry-run for safety

**Test Account Patterns:**

- Emails: `test*@*`, `*@test.*`, `*@example.com`, `*+test@*`
- Organizations: `*test*`, `*demo*`, `*example*`
- Customizable in `scripts/cleanup-test-accounts.ts`

**Safety Features:**

- Dry-run mode prevents accidental deletions
- Pattern-based identification reduces false positives
- Database cleanup maintains referential integrity
- Detailed logging for audit trails

---

## Links

- **Architecture:** `./architecture/README.md`
- **Decisions (ADRs):** `./decisions`
- **Roadmap:** `./roadmap.md`
- **Glossary:** `./glossary.md`
