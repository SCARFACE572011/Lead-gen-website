"""
Craigslist scraper — services section.
Many small businesses post here without a website — prime leads.
"""
import requests
import time
import random
import re
from bs4 import BeautifulSoup
from lead_db import upsert_lead, init_db

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
    )
}

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}")

# Craigslist city codes
CL_CITIES = [
    "newyork", "losangeles", "chicago", "houston", "phoenix",
    "philadelphia", "sanantonio", "sandiego", "dallas", "austin",
    "seattle", "denver", "nashville", "lasvegas", "portland",
    "atlanta", "miami", "boston", "minneapolis", "detroit",
    "baltimore", "raleigh", "charlotte", "indianapolis", "columbus",
]

# Service categories with high web design opportunity
CL_SECTIONS = [
    ("hss", "household"),
    ("lbs", "labor/move"),
    ("trp", "travel/vacation"),
    ("bts", "beauty/health"),
    ("aos", "automotive"),
    ("cms", "computer/tech"),
    ("crs", "creative"),
    ("fgs", "farm/garden"),
    ("fns", "financial"),
    ("lgs", "legal"),
    ("mar", "marine"),
    ("pet", "pet"),
    ("rts", "real estate"),
    ("sks", "skilled trades"),
    ("wet", "writing/editing"),
]


def scrape_cl_listing(url: str) -> dict:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(resp.text, "lxml")
        body = soup.select_one("#postingbody")
        text = body.get_text(" ", strip=True) if body else ""

        phones = PHONE_RE.findall(text)
        emails = EMAIL_RE.findall(text)
        title_el = soup.select_one("#titletextonly")
        title = title_el.get_text(strip=True) if title_el else ""

        # Check if they mention having a website
        has_site = 1 if any(kw in text.lower() for kw in ["www.", "http", ".com", "website", "our site"]) else 0

        return {
            "title": title,
            "phone": phones[0] if phones else "",
            "email": emails[0] if emails else "",
            "has_website": has_site,
            "notes": text[:300],
        }
    except Exception:
        return {}


def scrape_cl_section(city: str, section_code: str, section_name: str, max_pages=2) -> list[dict]:
    leads = []
    for page in range(max_pages):
        offset = page * 120
        url = f"https://{city}.craigslist.org/search/{section_code}?s={offset}"
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            soup = BeautifulSoup(resp.text, "lxml")
            posts = soup.select("li.cl-static-search-result")

            for post in posts:
                link = post.select_one("a[href]")
                if not link:
                    continue
                href = link.get("href", "")
                if not href.startswith("http"):
                    href = f"https://{city}.craigslist.org{href}"

                title_el = post.select_one(".label") or post.select_one("span")
                title = title_el.get_text(strip=True) if title_el else "Unknown"

                time.sleep(random.uniform(1.5, 3))
                detail = scrape_cl_listing(href)
                if not detail:
                    continue

                leads.append({
                    "business": detail.get("title") or title,
                    "category": section_name,
                    "city": city.replace("-", " ").title(),
                    "state": "",
                    "phone": detail.get("phone", ""),
                    "email": detail.get("email", ""),
                    "website": "",
                    "source": f"craigslist_{city}",
                    "has_website": detail.get("has_website", 0),
                    "yelp_rating": None,
                    "review_count": None,
                    "notes": detail.get("notes", ""),
                })

            time.sleep(random.uniform(2, 4))
        except Exception as e:
            print(f"  [!] Error scraping {city}/{section_code}: {e}")
            continue

    return leads


def run_craigslist_scrape(max_cities: int = 5, max_sections: int = 5):
    init_db()
    total_new = 0
    cities = CL_CITIES[:max_cities]
    sections = CL_SECTIONS[:max_sections]

    for city in cities:
        for code, name in sections:
            print(f"\nScraping CL: {city} / {name}")
            leads = scrape_cl_section(city, code, name, max_pages=1)
            for lead in leads:
                # Prioritize businesses with no website
                _, is_new = upsert_lead(lead)
                if is_new:
                    total_new += 1
                    flag = "NO SITE" if not lead["has_website"] else ""
                    print(f"  + {lead['business']} {flag}")

    print(f"\nDone. {total_new} new leads.")
    return total_new


if __name__ == "__main__":
    run_craigslist_scrape(max_cities=3, max_sections=3)
