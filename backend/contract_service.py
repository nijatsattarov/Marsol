"""Contract parsing + addendum generation service.

Handles two kinds of operations:
  1. Extract structured fields from an uploaded "main" service contract (DOCX).
  2. Generate an "addendum" (Müqaviləyə Əlavə) DOCX based on the extracted
     fields plus user-supplied pricing details.

The parser uses heuristic regexes tuned to the Marsol Group contract template
(see /app/memory/PRD.md for canonical samples). Failures are graceful: any
field that can't be detected is returned as an empty string so the user can
fill it in manually in the UI.
"""
from __future__ import annotations

import io
import re
from datetime import datetime
from typing import Dict, List, Optional

from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH


# ----------------------------------------------------------------------------
# PARSER
# ----------------------------------------------------------------------------

# Patterns are intentionally permissive — Azerbaijani contract numbering can
# look like "№ TS001/26", "№TS001-26", "№ MA-2025/14" etc.
_CONTRACT_NUM_RE = re.compile(r"№\s*([A-Za-zƏəĞğİıÖöÜüÇçŞş0-9\-/_]+)", re.UNICODE)
_VOEN_RE = re.compile(r"V[ÖöO]EN\s*[:\-]?\s*(\d{8,12})", re.IGNORECASE | re.UNICODE)
_DIRECTOR_RE = re.compile(r"direktoru\s+([A-Za-zƏəĞğİıÖöÜüÇçŞş\s\.'-]+?)\s+şəxs", re.UNICODE)
# Company names usually appear wrapped in “ ” or " " with the legal-form
# suffix (MMC, QSC, ASC, MMC-si). We grab the bit inside the guillemets.
_COMPANY_RE = re.compile(r"[“\"„]\s*([A-Za-zƏəĞğİıÖöÜüÇçŞş0-9\s\.&\-]+?)\s*[”\"“]\s*(?:QSC|MMC|ASC|Məhdud|Qapalı|Açıq)", re.UNICODE)


def _read_docx_text(file_bytes: bytes) -> str:
    """Return all paragraphs + table cells joined with newlines."""
    doc = Document(io.BytesIO(file_bytes))
    chunks: List[str] = []
    for p in doc.paragraphs:
        if p.text.strip():
            chunks.append(p.text)
    for tbl in doc.tables:
        for row in tbl.rows:
            for cell in row.cells:
                t = (cell.text or "").strip()
                if t:
                    chunks.append(t)
    return "\n".join(chunks)


def extract_contract_fields(file_bytes: bytes) -> Dict[str, str]:
    """Best-effort extraction. Returns dict with keys:
      contract_number, sifarisci_company, sifarisci_voen, sifarisci_authorized,
      icraci_company, icraci_voen, icraci_authorized, raw_text
    Any missing field comes back as empty string."""
    text = _read_docx_text(file_bytes)

    contract_number = ""
    m = _CONTRACT_NUM_RE.search(text)
    if m:
        contract_number = m.group(1).strip()

    # Find ALL VÖEN matches (usually 2: Sifarişçi + İcraçı). Marsol's VÖEN is
    # known to be 2004204701, so we use it to determine which side is which.
    voens = _VOEN_RE.findall(text)
    voens = list(dict.fromkeys(voens))  # preserve order, dedupe
    marsol_voen = "2004204701"
    sifarisci_voen = ""
    icraci_voen = marsol_voen
    for v in voens:
        if v != marsol_voen and not sifarisci_voen:
            sifarisci_voen = v

    # Director names — usually 2 of them
    directors = _DIRECTOR_RE.findall(text)
    directors = [d.strip() for d in directors]
    # Heuristic: director that appears with Marsol's VÖEN goes to icraci.
    # If we can't tell, the FIRST director in the doc is sifarisci.
    sifarisci_authorized = ""
    icraci_authorized = "Bilal Qasımlı"  # Marsol default
    for d in directors:
        if "qasım" not in d.lower() and "marsol" not in d.lower() and not sifarisci_authorized:
            sifarisci_authorized = d

    # Company names — pick first 2 distinct
    companies = _COMPANY_RE.findall(text)
    companies = [c.strip() for c in companies]
    companies = list(dict.fromkeys(companies))
    sifarisci_company = ""
    icraci_company = "MARSOL"
    for c in companies:
        if "marsol" not in c.lower() and not sifarisci_company:
            sifarisci_company = c

    return {
        "contract_number": contract_number,
        "sifarisci_company": sifarisci_company,
        "sifarisci_voen": sifarisci_voen,
        "sifarisci_authorized": sifarisci_authorized,
        "icraci_company": icraci_company,
        "icraci_voen": icraci_voen,
        "icraci_authorized": icraci_authorized,
        "raw_text_preview": text[:1500],
    }


# ----------------------------------------------------------------------------
# GENERATOR — Addendum (Müqaviləyə Əlavə)
# ----------------------------------------------------------------------------

# Marsol İcraçı reqviziləri default-da bunlardır. Üzərinə yazmaq mümkündür.
MARSOL_DEFAULT = {
    "name": "MARSOL",
    "full_name": "MARSOL Məhdud Məsuliyyətli Cəmiyyəti",
    "voen": "2004204701",
    "iban": "AZ41AIIB40060019440152635107",
    "bank_name": "Kapital Bank ASC Xətai filialı",
    "bank_branch_code": "200071",
    "bank_voen": "9900003611",
    "corr_account": "AZ37NABZ01350100000000001944",
    "swift": "AIIBAZ2X",
    "authorized": "Bilal Qasımlı",
}


def _fmt_money(value: float) -> str:
    """`12345.6` → `12 345.60` (Azerbaijani-style thousand separator with space)."""
    try:
        n = float(value)
    except (TypeError, ValueError):
        return "0.00"
    s = f"{n:,.2f}"  # 12,345.60
    return s.replace(",", " ")


def _set_font(run, size: int = 11, bold: bool = False):
    run.font.name = "Times New Roman"
    run.font.size = Pt(size)
    run.bold = bold


def _add_paragraph(doc: Document, text: str, *, bold: bool = False, size: int = 11,
                   align: int = WD_ALIGN_PARAGRAPH.JUSTIFY) -> None:
    p = doc.add_paragraph()
    p.alignment = align
    run = p.add_run(text)
    _set_font(run, size=size, bold=bold)


def generate_addendum_docx(data: Dict) -> bytes:
    """Build a Müqavilə Əlavə DOCX in memory and return its raw bytes.

    `data` is a dict shaped roughly like:
      {
        "addendum_number": "1",
        "addendum_date": "2027-05-15",
        "parent_contract_number": "TS001/26",
        "parent_contract_date": "2025-07-14",
        "sifarisci_company": "VİBROSTONE QSC",
        "sifarisci_voen": "1003013391",
        "sifarisci_authorized": "Nüsrət Dəmirov",
        "exhibition_name": "8-ci Yerli Şirkətlərin Tanıtım Sərgisi",
        "exhibition_start": "2027-06-23",
        "exhibition_end": "2027-06-26",
        "exhibition_location": "Bakı Ekspo Mərkəzi",
        "services": [{"name":"Stend təchizatı","description":"Arxa və yan divarlar..."}],
        "pricing": {
            "price_net": 1000.0,
            "vat_enabled": True,
            "vat_rate": 18,
            "vat_amount": 180.0,
            "total": 1180.0,
        },
      }
    """
    pricing = data.get("pricing", {}) or {}
    price_net = float(pricing.get("price_net") or 0)
    vat_enabled = bool(pricing.get("vat_enabled", True))
    vat_rate = float(pricing.get("vat_rate") or 18) if vat_enabled else 0
    vat_amount = round(price_net * vat_rate / 100, 2) if vat_enabled else 0.0
    total = round(price_net + vat_amount, 2)

    addendum_no = data.get("addendum_number") or "1"
    addendum_date = data.get("addendum_date") or datetime.now().strftime("%Y-%m-%d")
    parent_no = data.get("parent_contract_number") or "____"
    parent_date = data.get("parent_contract_date") or "__.__.20__"
    sif_co = data.get("sifarisci_company") or "_____________"
    sif_voen = data.get("sifarisci_voen") or "____________"
    sif_auth = data.get("sifarisci_authorized") or "_____________"

    ex_name = data.get("exhibition_name") or "________"
    ex_start = data.get("exhibition_start") or "__.__.20__"
    ex_end = data.get("exhibition_end") or "__.__.20__"
    ex_loc = data.get("exhibition_location") or "Bakı Ekspo Mərkəzi"

    services = data.get("services") or []

    doc = Document()
    # Page margins (cm)
    for section in doc.sections:
        section.top_margin = Cm(2)
        section.bottom_margin = Cm(2)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2)

    # --- Header ---
    _add_paragraph(doc, f"{parent_no} №-li Xidmət Müqaviləsinə əlavə №{addendum_no}",
                   bold=True, size=13, align=WD_ALIGN_PARAGRAPH.CENTER)
    _add_paragraph(doc, "XİDMƏT MÜQAVİLƏSİNƏ ƏLAVƏ", bold=True, size=14,
                   align=WD_ALIGN_PARAGRAPH.CENTER)
    _add_paragraph(doc, f"Bakı şəhəri, {addendum_date}", size=11,
                   align=WD_ALIGN_PARAGRAPH.CENTER)
    doc.add_paragraph()

    # --- Parties ---
    _add_paragraph(
        doc,
        f"Bu Əlavə, {parent_date} tarixli {parent_no} №-li Xidmət Müqaviləsinə əsasən hazırlanmışdır.",
    )

    _add_paragraph(doc, "Birinci Tərəf (İcraçı):", bold=True)
    _add_paragraph(doc, f"Şirkət adı: «{MARSOL_DEFAULT['full_name']}»")
    _add_paragraph(doc, f"VÖEN: {MARSOL_DEFAULT['voen']}")
    _add_paragraph(doc, f"Səlahiyyətli şəxs: {MARSOL_DEFAULT['authorized']}")

    _add_paragraph(doc, "İkinci Tərəf (Sifarişçi):", bold=True)
    _add_paragraph(doc, f"Şirkət adı: «{sif_co}»")
    _add_paragraph(doc, f"VÖEN: {sif_voen}")
    _add_paragraph(doc, f"Səlahiyyətli şəxs: {sif_auth}")

    doc.add_paragraph()

    # --- Section II: Razılaşmalar ---
    _add_paragraph(doc, "II. RAZILAŞMALAR", bold=True, size=12)
    _add_paragraph(
        doc,
        f"Tərəflər razılaşırlar ki, «İcraçı» {ex_start} – {ex_end} tarixlərində "
        f"{ex_loc}-də keçiriləcək {ex_name}-də «Sifarişçi»nin iştirakı üçün "
        f"{parent_date} tarixli {parent_no} №-li Xidmət Müqaviləsində nəzərdə "
        f"tutulmuş şərtlərlə aşağıdakı xidmətləri göstərir; «Sifarişçi» isə "
        f"göstərilmiş xidmətlərin müqabilində xidmət haqqının vaxtında "
        f"ödənilməsi öhdəliyini öz üzərinə götürür."
    )

    # --- Section III: Services table ---
    _add_paragraph(doc, "III. GÖSTƏRİLƏCƏK XİDMƏTLƏR", bold=True, size=12)

    if services:
        tbl = doc.add_table(rows=1, cols=2)
        tbl.style = "Table Grid"
        hdr = tbl.rows[0].cells
        for run in hdr[0].paragraphs[0].runs:
            run.text = ""
        h1 = hdr[0].paragraphs[0].add_run("Xidmət adı")
        _set_font(h1, bold=True)
        h2 = hdr[1].paragraphs[0].add_run("Təsviri")
        _set_font(h2, bold=True)
        for svc in services:
            row = tbl.add_row().cells
            row[0].text = svc.get("name", "")
            row[1].text = svc.get("description", "")

    doc.add_paragraph()

    # --- Section IV: Pricing table ---
    _add_paragraph(doc, "IV. QİYMƏT VƏ ÖDƏNİŞ", bold=True, size=12)
    price_tbl = doc.add_table(rows=1, cols=2)
    price_tbl.style = "Table Grid"
    rows = [
        ("Qiymət (ƏDV-siz)", f"{_fmt_money(price_net)} AZN"),
    ]
    if vat_enabled:
        rows.append((f"ƏDV ({vat_rate:g}%)", f"{_fmt_money(vat_amount)} AZN"))
    else:
        rows.append(("ƏDV", "Tətbiq edilmir"))
    rows.append(("Yekun məbləğ", f"{_fmt_money(total)} AZN"))

    hdr = price_tbl.rows[0].cells
    h1 = hdr[0].paragraphs[0].add_run("Maddə")
    _set_font(h1, bold=True)
    h2 = hdr[1].paragraphs[0].add_run("Məbləğ")
    _set_font(h2, bold=True)
    for k, v in rows:
        r = price_tbl.add_row().cells
        r[0].text = k
        r[1].text = v
        # Bold the total row
        if k == "Yekun məbləğ":
            for c in r:
                for p in c.paragraphs:
                    for run in p.runs:
                        _set_font(run, bold=True)

    doc.add_paragraph()

    # --- Section V: Legal status ---
    _add_paragraph(doc, "V. ƏLAVƏNİN HÜQUQİ STATUSU", bold=True, size=12)
    _add_paragraph(
        doc,
        f"Tərəflər razılaşırlar ki, hazırkı Əlavə {parent_date} tarixli {parent_no} "
        f"№-li Xidmət Müqaviləsinin ayrılmaz tərkib hissəsi olmaqla Müqavilənin "
        f"şərh edilməsində əsas götürülür."
    )
    _add_paragraph(
        doc,
        "Hazırkı Əlavəyə hər hansı əlavələr və ya düzəlişlər yalnız imzalandıqdan "
        "və möhürləndikdən sonra hüquqi qüvvəyə malikdir."
    )
    _add_paragraph(
        doc,
        "Hazırkı Əlavə Azərbaycan dilində, eyni hüquqi qüvvəyə malik 2 (iki) "
        "nüsxədə tərtib edilmişdir, nüsxələrdən biri Sifarişçidə, digəri isə "
        "İcraçıda saxlanılır."
    )

    doc.add_paragraph()

    # --- Signatures ---
    _add_paragraph(doc, "TƏRƏFLƏRİN İMZALARI", bold=True, size=12, align=WD_ALIGN_PARAGRAPH.CENTER)
    sig_tbl = doc.add_table(rows=1, cols=2)
    sig_tbl.style = "Table Grid"
    sif_cell = sig_tbl.rows[0].cells[0]
    icr_cell = sig_tbl.rows[0].cells[1]

    def _add_sig_block(cell, title, company, voen, person):
        cell.text = ""
        p = cell.paragraphs[0]
        r = p.add_run(title); _set_font(r, bold=True); p.add_run("\n")
        r = cell.add_paragraph().add_run(f"Şirkət: «{company}»"); _set_font(r)
        r = cell.add_paragraph().add_run(f"VÖEN: {voen}"); _set_font(r)
        r = cell.add_paragraph().add_run(f"Səlahiyyətli şəxs: {person}"); _set_font(r)
        cell.add_paragraph("_______________________")
        r = cell.add_paragraph().add_run("İmza / Möhür"); _set_font(r)

    _add_sig_block(sif_cell, "Sifarişçi", sif_co, sif_voen, sif_auth)
    _add_sig_block(icr_cell, "İcraçı", MARSOL_DEFAULT["full_name"],
                   MARSOL_DEFAULT["voen"], MARSOL_DEFAULT["authorized"])

    out = io.BytesIO()
    doc.save(out)
    return out.getvalue()
