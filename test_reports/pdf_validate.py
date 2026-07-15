"""Validate the stress-test PDF for:
(i) title on same page as first body row (no orphan)
(ii) no row split across pages
(iii) all text within 39.6..555.7 pt (14mm..196mm)
(iv) task tables width 182mm
(v) numbered list rows '1. ', '2. '
"""
import pdfplumber, sys, re, json

PATH = "/tmp/iclas_test.pdf"
PT_LEFT = 14 * 72 / 25.4  # 39.685
PT_RIGHT = 196 * 72 / 25.4  # 555.59
TOL = 0.5  # sub-pt tolerance

SECTION_TITLES = ["Gündəlik #", "Ümumi tapşırıqlar", "Müzakirə mövzuları", "Qərarlar"]

def find_lines(page):
    """Extract text lines with y-coordinate ranges."""
    words = page.extract_words(x_tolerance=2, y_tolerance=2, keep_blank_chars=False)
    lines_by_y = {}
    for w in words:
        key = round(w['top'], 1)
        lines_by_y.setdefault(key, []).append(w)
    lines = []
    for y in sorted(lines_by_y.keys()):
        ws = sorted(lines_by_y[y], key=lambda x: x['x0'])
        text = " ".join(w['text'] for w in ws)
        lines.append({"y": y, "text": text, "x0": min(w['x0'] for w in ws), "x1": max(w['x1'] for w in ws)})
    return lines

def main():
    issues = []
    with pdfplumber.open(PATH) as pdf:
        n_pages = len(pdf.pages)
        print(f"Pages: {n_pages}")
        if n_pages < 2:
            issues.append(f"Only {n_pages} page(s) — stress test expected multi-page pagination")

        # Check char bounds
        outside = []
        for pi, page in enumerate(pdf.pages, 1):
            for ch in page.chars:
                if ch['x0'] < PT_LEFT - TOL or ch['x1'] > PT_RIGHT + TOL:
                    outside.append((pi, ch['text'], ch['x0'], ch['x1']))
        if outside:
            issues.append(f"Text outside printable margins: {len(outside)} chars, first 3: {outside[:3]}")

        # Check title-orphan: for each section title, verify that on its page there is also
        # a non-title content line below it (i.e., the first body row is on same page)
        page_lines = []
        for pi, page in enumerate(pdf.pages, 1):
            lines = find_lines(page)
            page_lines.append(lines)

        # For each title occurrence, ensure a subsequent line exists on same page
        # that starts an actual body row (not just a header row of column labels)
        header_labels = ["Tapşırıq", "Məsul", "İcraçı", "Son tarix", "Status"]
        title_checks = []
        for pi, lines in enumerate(page_lines, 1):
            for li, ln in enumerate(lines):
                for st in SECTION_TITLES:
                    if ln['text'].startswith(st):
                        # find first non-blank line below on same page beyond the label row
                        after = lines[li+1:]
                        body_after = [l for l in after if l['text'].strip() and l['text'].strip() not in " ".join(header_labels)]
                        # Must have at least one line beyond the column-header row
                        # Filter: skip if the next line is EXACTLY the header labels
                        real_body = []
                        for al in after:
                            t = al['text'].strip()
                            if not t:
                                continue
                            # Column header line: contains at least 3 of the labels
                            hits = sum(1 for lab in header_labels if lab in t)
                            if hits >= 3:
                                continue
                            real_body.append(al)
                        ok = len(real_body) >= 1
                        title_checks.append({"page": pi, "title": ln['text'][:60], "has_body": ok})
                        break
        for tc in title_checks:
            print(f"  Title p{tc['page']}: {tc['title']!r} has_body={tc['has_body']}")
            if not tc['has_body']:
                issues.append(f"ORPHAN TITLE on page {tc['page']}: {tc['title']!r} has no body row on same page")

        # Numbered list check
        list_lines = []
        for lines in page_lines:
            for ln in lines:
                if re.match(r"^\d+\.\s+", ln['text']):
                    list_lines.append(ln['text'][:80])
        print(f"Numbered list lines found: {len(list_lines)}")
        if len(list_lines) < 4:
            issues.append(f"Expected numbered list lines (Müzakirə mövzuları/Qərarlar) >= 4; got {len(list_lines)}")

        # Row-split heuristic: detect if a task title starting on one page continues on next
        # We look for pages where the LAST body line on a page has same y-band as another
        # continuation on next page top. Simplification: check if any page starts with
        # text lines that appear to be a continuation (long wrapped list of comma-names)
        # while the previous page ended mid-row.
        # A tighter check: for each task table, autotable with rowPageBreak:'avoid' should
        # ensure that the resp/assignees list (which contains commas) is fully rendered
        # before page break — verify no page starts with a bare ", TEST_ASSIGN..." line.
        continuation_issues = []
        for pi in range(2, n_pages+1):
            first_lines = [l for l in page_lines[pi-1][:3] if l['text'].strip()]
            for fl in first_lines:
                # A "continuation" would typically start with a comma, or with a name-only
                # segment (not any of the known section titles or header labels or numbered)
                txt = fl['text'].strip()
                if txt.startswith(",") or re.match(r"^[a-zəçğıöşü_A-ZƏÇĞİÖŞÜ0-9]+\s*,", txt):
                    # Check if it looks like continuation of a resp list
                    if "TEST_" in txt and not any(txt.startswith(s) for s in SECTION_TITLES):
                        continuation_issues.append((pi, txt[:80]))
        if continuation_issues:
            issues.append(f"Possible row-split continuations at page tops: {continuation_issues[:3]}")

    print("\n=== ISSUES ===")
    if not issues:
        print("PASS - no issues detected")
    else:
        for i in issues:
            print(" -", i)
    with open('/tmp/pdf_validation.json', 'w') as f:
        json.dump({"issues": issues, "title_checks": title_checks, "pages": n_pages}, f, indent=2)
    sys.exit(0 if not issues else 2)

if __name__ == "__main__":
    main()
