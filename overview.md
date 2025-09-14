# Sojourns - Luxury Travel Itinerary Platform

## Overview

Luxury travel itinerary platform where users upload travel documents (confirmations, itineraries) and Miles AI automatically extracts and populates trip details, places, and items.

## Current Status

### Phase 1: Document Upload System ✅ COMPLETE

- Document upload with Cloudflare R2 storage
- Multi-file upload support with progress states
- Organization-level access control with Clerk authentication
- Documents table tracking with status badges
- Build issues resolved with Clerk SDK lazy-loading

### Phase 2: AI Document Processing 🚧 NEXT UP

#### LLM Strategy for Document Parsing

**Recommended Model**: GPT-4o Mini + Vision

- Cost-effective for travel document parsing
- Handles both text and image documents (PDFs, confirmations, itineraries)
- Good structured extraction capabilities
- Easy OpenAI SDK integration

#### Document Processing Pipeline

1. **Multi-Modal Document Handling**:
   - PDFs: Extract text + images
   - Images: Direct vision analysis
   - Text: Standard text processing

2. **Structured Extraction Schema**:

   ```json
   {
     "places": [
       {
         "name": "string",
         "type": "accommodation|restaurant|attraction",
         "address": "string",
         "dates": {}
       }
     ],
     "transportation": [
       { "type": "flight|train|car|bus", "details": {}, "dates": {} }
     ],
     "activities": [
       { "name": "string", "location": "string", "dateTime": "string" }
     ]
   }
   ```

3. **Training & Improvement Strategy**:
   - **Week 1-2**: Few-shot learning with example prompts
   - **Month 1**: Human-in-the-loop feedback collection
   - **Month 2+**: Fine-tuning for high-volume processing

#### Implementation Plan

- [ ] Create background job queue for document processing
- [ ] Implement LLM document parsing with AI SDK
- [ ] Create API to update trip/items/places from parsed data
- [ ] Add user correction interface for AI improvements
- [ ] Implement confidence scoring and review workflow

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript
- **Backend**: Next.js API routes, Drizzle ORM
- **Database**: Neon PostgreSQL
- **Authentication**: Clerk with organization support
- **Storage**: Cloudflare R2 (S3-compatible)
- **AI**: OpenAI GPT-4o Mini (planned)

## Database Schema

- `trips` - Core trip information
- `places` - Hotels, restaurants, attractions
- `items` - Trip activities and experiences
- `documents` - Uploaded files with processing status
- `users` & `memberships` - Authentication and organization management
