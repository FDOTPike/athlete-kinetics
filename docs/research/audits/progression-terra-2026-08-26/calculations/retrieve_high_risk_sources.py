"""Retrieve public metadata/abstracts for the audit high-risk queue.
Run: python retrieve_high_risk_sources.py
Writes only audit-local source_metadata.json.
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
PMIDS = [
    "34542869", "27787474", "33424678", "32881842", "32681399", "29466268",
    "21873902", "20179649", "27038416", "32049887", "28834797", "30063555",
    "38970765", "18714230", "37967832", "29204323", "38086002", "40249908",
    "42119794", "42506841", "42297625", "42328880", "42617172", "31009432",
    "33520457", "32813181", "25601394", "27174923", "30153194", "37792272",
]
DOIS = [
    "10.1519/JSC.0000000000002776", "10.1007/s40279-021-01559-x",
    "10.1519/JSC.0000000000003779", "10.1519/JSC.0000000000001683",
    "10.3389/fpsyg.2020.565416", "10.1519/JSC.0b013e31820c8587",
    "10.1519/JSC.0b013e3181bde2cf", "10.1007/s40279-020-01330-8",
    "10.1101/2025.09.22.25336351", "10.3390/jfmk11010080",
]


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "progression-audit/1.0 contact: audit"})
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()


def pubmed(pmid: str) -> dict:
    xml = get("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=" + pmid + "&retmode=xml")
    root = ET.fromstring(xml)
    art = root.find(".//PubmedArticle")
    title = "".join(art.find(".//ArticleTitle").itertext()) if art is not None and art.find(".//ArticleTitle") is not None else None
    abstract = "\n".join("".join(e.itertext()) for e in art.findall(".//Abstract/AbstractText")) if art is not None else ""
    journal = art.findtext(".//Journal/Title") if art is not None else None
    year = art.findtext(".//PubDate/Year") if art is not None else None
    if not year and art is not None:
        year = art.findtext(".//ArticleDate/Year")
    return {"pmid": pmid, "title": title, "journal": journal, "year": year, "abstract": abstract, "verification_depth": "PubMed abstract"}


def crossref(doi: str) -> dict:
    raw = get("https://api.crossref.org/works/" + urllib.parse.quote(doi, safe=""))
    msg = json.loads(raw)["message"]
    return {"doi": doi, "title": (msg.get("title") or [None])[0], "type": msg.get("type"), "published": msg.get("published-print") or msg.get("published-online"), "publisher": msg.get("publisher"), "verification_depth": "Crossref metadata"}

out = {"retrieved_at_utc": datetime.now(timezone.utc).isoformat(), "pubmed": [], "crossref": [], "errors": []}
for p in PMIDS:
    try:
        out["pubmed"].append(pubmed(p))
    except Exception as exc:  # audit requires visibility of failures
        out["errors"].append({"source": p, "error": repr(exc)})
    time.sleep(0.35)
for d in DOIS:
    try:
        out["crossref"].append(crossref(d))
    except Exception as exc:
        out["errors"].append({"source": d, "error": repr(exc)})
    time.sleep(0.8)
(ROOT / "source_metadata.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
print(json.dumps({"pubmed_records": len(out["pubmed"]), "crossref_records": len(out["crossref"]), "errors": out["errors"]}, indent=2))
