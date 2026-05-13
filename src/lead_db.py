"""
Lead database — SQLite-backed store for scraped business contacts.
"""
import sqlite3
import json
import csv
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "leads.db"


def get_conn():
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS leads (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            business    TEXT NOT NULL,
            category    TEXT,
            city        TEXT,
            state       TEXT,
            phone       TEXT,
            email       TEXT,
            website     TEXT,
            source      TEXT,
            has_website INTEGER DEFAULT 0,
            yelp_rating REAL,
            review_count INTEGER,
            notes       TEXT,
            outreach_status TEXT DEFAULT 'new',
            outreach_sent_at TEXT,
            created_at  TEXT DEFAULT (datetime('now')),
            UNIQUE(business, city, phone)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS outreach_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id     INTEGER REFERENCES leads(id),
            subject     TEXT,
            body        TEXT,
            sent_at     TEXT DEFAULT (datetime('now')),
            channel     TEXT DEFAULT 'email'
        )
    """)
    conn.commit()
    conn.close()
    print(f"DB ready at {DB_PATH}")


def upsert_lead(data: dict) -> tuple[int, bool]:
    """Insert or ignore duplicate lead. Returns (id, is_new)."""
    conn = get_conn()
    cur = conn.execute("""
        INSERT OR IGNORE INTO leads
            (business, category, city, state, phone, email, website,
             source, has_website, yelp_rating, review_count, notes)
        VALUES
            (:business,:category,:city,:state,:phone,:email,:website,
             :source,:has_website,:yelp_rating,:review_count,:notes)
    """, data)
    is_new = cur.rowcount > 0
    conn.commit()

    row = conn.execute(
        "SELECT id FROM leads WHERE business=? AND city=? AND phone=?",
        (data.get("business"), data.get("city"), data.get("phone"))
    ).fetchone()
    conn.close()
    return (row["id"] if row else None, is_new)


def get_leads(status="new", limit=50) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM leads WHERE outreach_status=? ORDER BY has_website ASC, review_count DESC LIMIT ?",
        (status, limit)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def mark_outreach_sent(lead_id: int):
    conn = get_conn()
    conn.execute(
        "UPDATE leads SET outreach_status='contacted', outreach_sent_at=? WHERE id=?",
        (datetime.now().isoformat(), lead_id)
    )
    conn.commit()
    conn.close()


def log_outreach(lead_id: int, subject: str, body: str, channel="email"):
    conn = get_conn()
    conn.execute(
        "INSERT INTO outreach_log (lead_id, subject, body, channel) VALUES (?,?,?,?)",
        (lead_id, subject, body, channel)
    )
    conn.commit()
    conn.close()


def export_csv(path="data/exports/leads.csv"):
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    conn = get_conn()
    rows = conn.execute("SELECT * FROM leads ORDER BY created_at DESC").fetchall()
    conn.close()
    with open(out, "w", newline="") as f:
        if rows:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows([dict(r) for r in rows])
    print(f"Exported {len(rows)} leads to {out}")
    return str(out)


def stats():
    conn = get_conn()
    total = conn.execute("SELECT COUNT(*) FROM leads").fetchone()[0]
    by_status = conn.execute(
        "SELECT outreach_status, COUNT(*) as n FROM leads GROUP BY outreach_status"
    ).fetchall()
    no_site = conn.execute("SELECT COUNT(*) FROM leads WHERE has_website=0").fetchone()[0]
    conn.close()
    print(f"\nLead DB Stats:")
    print(f"  Total leads  : {total}")
    print(f"  No website   : {no_site}")
    for row in by_status:
        print(f"  {row[0]:12s}: {row[1]}")


if __name__ == "__main__":
    init_db()
    stats()
