# Lead Gen & Outreach System

## Project Purpose
Automated lead generation and outreach pipeline for Optodiode (optodiode.com).

## Directory Structure
- `src/` — scraper and enrichment scripts
- `data/` — lead CSVs, enriched profiles, deduplication DB
- `outreach/` — email templates and sequences
- `scripts/` — one-off utilities and automation runners

## Key Tools Available
- Gmail MCP — send/search/draft outreach emails
- Google Drive MCP — store/share lead sheets
- Microsoft 365 MCP — Outlook outreach alternative
- WebSearch + WebFetch — public data scraping
- Agent tool — spawn parallel enrichment workers

## Lead Gen Workflow
1. Scrape targets (GitHub, LinkedIn, company sites) via WebSearch/WebFetch
2. Enrich with contact info and qualification data
3. Deduplicate against `data/leads.json`
4. Generate personalized outreach via templates in `outreach/`
5. Send/schedule via Gmail or M365 MCP

## Permissions
All tools run in bypassPermissions mode — no confirmation prompts.
