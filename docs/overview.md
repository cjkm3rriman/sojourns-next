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

## Links

- **Architecture:** `./architecture/README.md`
- **Decisions (ADRs):** `./decisions`
- **Roadmap:** `./roadmap.md`
- **Glossary:** `./glossary.md`
