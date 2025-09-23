# Roadmap

## 🛠️ Build Order

### 1. Core Foundations (Auth + DB)

- **Auth:** Set up Clerk (organizations, users, roles).
- **Database:** Neon + Drizzle with minimal schema:
  - `Organization`
  - `User`
  - `Membership`
  - `Trip`
  - `ItineraryItem`

⚡ **Outcome:** Agents can log in, have org context, and persist trips/items.

---

### 2. Agent Admin Basics

- Next.js admin shell with protected routes.
- CRUD for trips and itinerary items.
- File upload → Cloudflare R2 with presigned URLs.

⚡ **Outcome:** Agents can create and manage itineraries manually.

---

### 3. Generative AI Itinerary Builder

- Add **“Generate itinerary”** button in admin.
- API route calls OpenAI (via Vercel AI SDK).
- Parse and save structured items to the database.

⚡ **Outcome:** Agents see immediate AI-driven productivity boost.

---

### 4. Traveler Client Basics

- Expo React Native app with Clerk auth.
- Basic traveler dashboard: list of trips and items.
- Start read-only.

⚡ **Outcome:** End-to-end flow: agent creates → traveler sees.

---

### 5. PDF Export + Sharing

- Generate branded PDFs via `@react-pdf/renderer`.
- Store in R2; share link or email.

⚡ **Outcome:** Meets agents where they are today (deliverable they trust).

---

### 6. Billing

- Stripe Checkout integration.
- Webhook → update org plan and seat limits.
- Enforce entitlements in admin.

⚡ **Outcome:** Capture revenue from pilot customers.

---

### 7. Enhancements & Polish

- Traveler extras (co-traveler invites, notes/plans).
- AI Q&A (“Ask about my trip”).
- Admin preview of traveler app (React Native Web or SDUI).
- Performance optimizations (ISR for traveler views, cron jobs).

---

## 📋 Technical Debt & Migration Notes

### OpenAI Assistants API Migration (2026)

- **Current Status:** Using Assistants API v2 with File Search (fully supported)
- **Future Migration:** Entire Assistants API will be deprecated in early/mid 2026
- **Action Required:** Migrate to OpenAI's Responses API before deprecation
- **Timeline:** Plan migration in 2025, complete before 2026 sunset
- **Impact:** File search functionality will continue in Responses API with feature parity

### PDF Analysis System Improvements (Next Session)

- **Optimize Data Structure:** Continue refining items and places schema and values
  - Review field usage and optimize for travel agent workflows
  - Consider adding more structured data fields (confirmation numbers, vendor info, etc.)
  - Evaluate place categorization effectiveness
- **Improve AI Accuracy:** Enhanced prompt engineering and validation
  - **CRITICAL:** Current prompt changes improved transfer detection but reduced hotel/restaurant accuracy
  - Need to rebalance prompt to maintain transfer detection while improving accommodation/dining extraction
  - Fine-tune prompts based on real-world document analysis results
  - Add better context understanding for complex travel documents
  - Implement validation rules to catch common AI extraction errors
- **User Notifications:** Add basic notification system for AI processing completion
  - Real-time status updates during PDF analysis
  - Success/failure notifications with actionable messages
  - Progress indicators for multi-document processing

### OpenAI Performance Optimization

- **✅ Completed:** Upgraded from GPT-4o to GPT-5 for faster responses and lower costs
- **Model Selection Strategy:**
  - Implement GPT-4o-mini for simpler extractions (basic flight/hotel data)
  - Reserve GPT-5 for complex multi-item documents
  - Add streaming responses for real-time user feedback during processing
- **Prompt Optimization:**
  - Reduce prompt size (current prompt is quite large)
  - Implement structured outputs with JSON schema validation
  - Break complex documents into smaller, parallel-processable chunks
- **Caching Strategies:**
  - Leverage 90% caching discount for repeated prompt parts
  - Cache system prompt and examples to reduce token usage
  - Implement intelligent caching for common document patterns
- **Parallel Processing:**
  - Process multiple documents simultaneously instead of sequentially
  - Split large documents into parallel chunks for faster processing
  - Add document queue management for batch processing
- **Context Management:**
  - Utilize GPT-5's larger context window (272K tokens) to process more in one call
  - Reduce back-and-forth API calls by bundling related operations
  - Implement smart context window management for optimal token usage
- **Performance Monitoring:**
  - Add response time tracking and analytics
  - Implement cost monitoring per document type
  - Create performance benchmarks for different optimization strategies

---

## ⏱️ Suggested Timeline (Lean MVP Track)

- **Week 1–2:** Auth + DB + admin CRUD.
- **Week 3:** AI itinerary builder.
- **Week 4:** Traveler app (read-only).
- **Week 5:** PDF export.
- **Week 6:** Stripe billing.
- **Week 7+:** Iterations, polish, pilot with agents.
