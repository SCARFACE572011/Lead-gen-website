"""
Yelp scraper — finds local businesses that have no website listed.
Targets categories that commonly need web/marketing help.
Uses requests + BeautifulSoup (no API key needed).
"""
import requests
import time
import random
from bs4 import BeautifulSoup
from lead_db import upsert_lead, init_db

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

# High-opportunity categories for web design upsell
TARGET_CATEGORIES = [
    "restaurants",
    "plumbers",
    "electricians",
    "landscaping",
    "auto-repair",
    "hair-salons",
    "nail-salons",
    "cleaning",
    "painters",
    "roofing",
    "dentists",
    "chiropractors",
    "gyms",
    "pet-grooming",
    "flooring",
    "hvac",
    "contractors",
    "movers",
    "catering",
    "photographers",
]

# Major US cities to rotate through
CITIES = [
    "New+York+NY", "Los+Angeles+CA", "Chicago+IL", "Houston+TX",
    "Phoenix+AZ", "Philadelphia+PA", "San+Antonio+TX", "San+Diego+CA",
    "Dallas+TX", "Jacksonville+FL", "Austin+TX", "Fort+Worth+TX",
    "Columbus+OH", "Charlotte+NC", "Indianapolis+IN", "San+Francisco+CA",
    "Seattle+WA", "Denver+CO", "Nashville+TN", "Oklahoma+City+OK",
    "El+Paso+TX", "Las+Vegas+NV", "Louisville+KY", "Portland+OR",
    "Memphis+TN", "Baltimore+MD", "Milwaukee+WI", "Albuquerque+NM",
    "Tucson+AZ", "Fresno+CA", "Sacramento+CA", "Kansas+City+MO",
    "Mesa+AZ", "Atlanta+GA", "Omaha+NE", "Colorado+Springs+CO",
    "Raleigh+NC", "Long+Beach+CA", "Virginia+Beach+VA", "Minneapolis+MN",
]


def parse_city_state(location_str: str) -> tuple[str, str]:
    parts = location_str.replace("+", " ").rsplit(" ", 1)
    if len(parts) == 2:
        return parts[0], parts[1]
    return parts[0], ""


def scrape_yelp_page(category: str, location: str, page_offset: int = 0) -> list[dict]:
    url = (
        f"https://www.yelp.com/search?find_desc={category}"
        f"&find_loc={location}&start={page_offset}"
    )
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            print(f"  [!] HTTP {resp.status_code} for {url}")
            return []
    except Exception as e:
        print(f"  [!] Request failed: {e}")
        return []

    soup = BeautifulSoup(resp.text, "lxml")
    leads = []
    city, state = parse_city_state(location)

    # Yelp result cards
    cards = soup.select('[data-testid="serp-ia-card"]') or soup.select(".businessName__09f24__EYSZE")

    # Fallback: look for JSON-LD structured data
    import json, re
    scripts = soup.find_all("script", type="application/ld+json")
    for script in scripts:
        try:
            data = json.loads(script.string or "")
            items = data if isinstance(data, list) else [data]
            for item in items:
                if item.get("@type") not in ("LocalBusiness", "Restaurant", "Store"):
                    continue
                name = item.get("name", "").strip()
                phone = item.get("telephone", "").strip()
                website = item.get("url", "").strip()
                addr = item.get("address", {})
                biz_city = addr.get("addressLocality", city)
                biz_state = addr.get("addressRegion", state)

                if not name:
                    continue

                has_site = 1 if website and "yelp.com" not in website else 0
                lead = {
                    "business": name,
                    "category": category,
                    "city": biz_city,
                    "state": biz_state,
                    "phone": phone,
                    "email": "",
                    "website": website,
                    "source": "yelp",
                    "has_website": has_site,
                    "yelp_rating": item.get("aggregateRating", {}).get("ratingValue"),
                    "review_count": item.get("aggregateRating", {}).get("reviewCount"),
                    "notes": "",
                }
                leads.append(lead)
        except Exception:
            continue

    return leads


def run_scrape(max_per_category: int = 5, categories=None, cities=None):
    """
    Scrape Yelp for businesses without websites across categories and cities.
    Prioritizes businesses with no website (best leads).
    """
    init_db()
    cats = categories or TARGET_CATEGORIES
    locs = cities or CITIES

    total_new = 0
    total_seen = 0

    for category in cats:
        for location in locs:
            print(f"\nScraping: {category} in {location.replace('+', ' ')}")
            for page in range(max_per_category):
                offset = page * 10
                leads = scrape_yelp_page(category, location, offset)
                if not leads:
                    break

                for lead in leads:
                    _, is_new = upsert_lead(lead)
                    total_seen += 1
                    if is_new:
                        total_new += 1
                        flag = "NO SITE" if not lead["has_website"] else ""
                        print(f"  + {lead['business']} ({lead['city']}) {flag}")

                delay = random.uniform(2.5, 5.0)
                time.sleep(delay)

    print(f"\nDone. {total_new} new leads added ({total_seen} total processed).")
    return total_new


if __name__ == "__main__":
    import sys
    cats = sys.argv[1:] if len(sys.argv) > 1 else None
    run_scrape(max_per_category=2, categories=cats)
