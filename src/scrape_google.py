"""
Google search scraper — finds businesses via search queries, extracts contact info.
Looks for businesses that signal poor/no web presence.
"""
import requests
import time
import random
import re
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from lead_db import upsert_lead, init_db

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}")

# Search queries designed to surface businesses WITHOUT a web presence
NO_WEBSITE_QUERIES = [
    '"{category}" site:yelp.com "not provided" OR "no website"',
    '"{category}" "call us" -site:yelp.com -site:google.com -site:facebook.com',
    'local "{category}" business "no website" contact phone',
]

CATEGORY_QUERIES = [
    ("plumber", "local plumber contact no website"),
    ("electrician", "electrician small business phone number"),
    ("landscaping", "landscaping company local no website"),
    ("painter", "house painter contractor phone"),
    ("roofer", "roofing company local contractor"),
    ("hvac", "hvac repair local business"),
    ("cleaning service", "cleaning service local small business phone"),
    ("auto repair", "auto repair shop local phone"),
    ("hair salon", "hair salon local phone no website"),
    ("restaurant", "local restaurant no website phone"),
    ("photographer", "local photographer contact no website"),
    ("catering", "catering company local small business"),
    ("flooring", "flooring contractor local phone"),
    ("moving company", "moving company local no website"),
    ("pest control", "pest control local small business phone"),
    ("handyman", "handyman service local no website contact"),
    ("dog groomer", "dog grooming local small business phone"),
    ("dentist", "dentist office local no website"),
    ("chiropractor", "chiropractor local small practice"),
    ("gym", "local gym fitness studio no website"),
]


def extract_contact_from_page(url: str) -> dict:
    """Fetch a page and extract email/phone."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        text = resp.text
        emails = list(set(EMAIL_RE.findall(text)))
        phones = list(set(PHONE_RE.findall(text)))
        # Filter common false positives
        emails = [e for e in emails if not any(x in e for x in ["example", "test@", "noreply", ".png", ".jpg"])]
        return {
            "email": emails[0] if emails else "",
            "phone": phones[0] if phones else "",
        }
    except Exception:
        return {"email": "", "phone": ""}


def parse_google_results(html: str) -> list[dict]:
    """Parse Google search result snippets for business info."""
    soup = BeautifulSoup(html, "lxml")
    results = []

    for g in soup.select("div.g"):
        title_el = g.select_one("h3")
        link_el = g.select_one("a[href]")
        snippet_el = g.select_one("div[data-sncf]") or g.select_one(".VwiC3b")

        if not title_el or not link_el:
            continue

        title = title_el.get_text(strip=True)
        href = link_el.get("href", "")
        snippet = snippet_el.get_text(strip=True) if snippet_el else ""

        # Skip aggregator sites
        skip = ["yelp.com", "google.com", "facebook.com", "yellowpages.com",
                "bbb.org", "angi.com", "thumbtack.com", "houzz.com", "linkedin.com"]
        if any(s in href for s in skip):
            continue

        phones = PHONE_RE.findall(snippet)
        emails = EMAIL_RE.findall(snippet)

        results.append({
            "title": title,
            "url": href,
            "snippet": snippet,
            "phone": phones[0] if phones else "",
            "email": emails[0] if emails else "",
        })

    return results


def google_search(query: str, num=20) -> str:
    url = f"https://www.google.com/search?q={requests.utils.quote(query)}&num={num}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        return resp.text
    except Exception as e:
        print(f"  [!] Google search failed: {e}")
        return ""


def run_google_scrape(max_queries: int = 10):
    init_db()
    total_new = 0
    queries = CATEGORY_QUERIES[:max_queries]

    for category, query in queries:
        print(f"\nSearching: {query}")
        html = google_search(query)
        if not html:
            continue

        results = parse_google_results(html)
        for r in results:
            # Try to enrich with contact info from the actual page
            contact = {"email": r["email"], "phone": r["phone"]}
            if r["url"].startswith("http") and (not contact["email"] or not contact["phone"]):
                time.sleep(random.uniform(1, 2))
                page_contact = extract_contact_from_page(r["url"])
                contact["email"] = contact["email"] or page_contact["email"]
                contact["phone"] = contact["phone"] or page_contact["phone"]

            domain = urlparse(r["url"]).netloc
            lead = {
                "business": r["title"],
                "category": category,
                "city": "",
                "state": "",
                "phone": contact["phone"],
                "email": contact["email"],
                "website": r["url"] if r["url"].startswith("http") else "",
                "source": "google_search",
                "has_website": 1 if r["url"].startswith("http") and domain else 0,
                "yelp_rating": None,
                "review_count": None,
                "notes": r["snippet"][:200],
            }
            _, is_new = upsert_lead(lead)
            if is_new:
                total_new += 1
                print(f"  + {lead['business']} ({contact['phone'] or 'no phone'})")

        time.sleep(random.uniform(4, 8))

    print(f"\nDone. {total_new} new leads added.")
    return total_new


if __name__ == "__main__":
    run_google_scrape(max_queries=5)
