# Glossary

- Domain Term: Clear definition and any constraints.
- Actor/Persona: Who interacts with the system and how.
- Entity: Key data object and what it represents.

Add terms as they emerge to ensure shared language across code, docs, and discussions.

## Core Terms

- Agents: Licensed travel professionals who quote, book, and manage trips for Clients. Belong to an Agency and may operate under a Host Agency. In the app, authenticated users with role=agent; key actions include creating itineraries for their clients.

- Agency: A legal business employing or contracting Agents. Owns branding, supplier agreements, accounting, and reporting.

- Host Agency: An umbrella organization providing accreditation (e.g., IATA/ARC/CLIA), supplier relationships, tools, and back‑office services to multiple independent Agencies or solo Agents. Centralizes commission reconciliation and compliance; may enforce global configurations.

- Clients: The paying customers of an Agent/Agency (individuals or organizations). Have profiles, preferences, payment methods, and consent/privacy settings. A Client can be linked to one or more Travellers and to multiple bookings over time.

- Travellers: The people who actually travel on an itinerary. May be the Client or associated to a Client (e.g., employees, family members). Store PII and document details (name, DOB, passport) used for reservations, manifests, and compliance.
