"""
Extract prompt/expectation pairs from NEURO World Training Documentation.
Reads from backend/neuro_doc_extracted.txt (or project root NEURO docx if txt missing),
writes backend/app/prompt_hub/neuro_training_dataset.yaml. The seed script then
loads this YAML and creates Dataset + Query rows in batches of 50.

Pairs are (query, expectations) from User N: / Expected Myla|Luna|Nuri|... and
Turn N (User ...): / Expected: patterns in the Training Content section.
"""
import re
import yaml
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND.parent
EXTRACTED_PATH = BACKEND / "neuro_doc_extracted.txt"
DOCX_PATH = PROJECT_ROOT / "NEURO World Training Documentation.docx"
OUT_YAML_PATH = BACKEND / "app" / "prompt_hub" / "neuro_training_dataset.yaml"

# Line patterns
USER_LINE = re.compile(r"^User \d+:\s*(.+)$")
TURN_LINE = re.compile(r"^Turn \d+ \(User[^)]*\):\s*(.+)$")
EXPECTED_START = re.compile(
    r"^Expected (Myla|Luna|Nuri|Spark|Flo):\s*(.*)$", re.IGNORECASE
)
EXPECTED_GENERIC = re.compile(r"^Expected:\s*(.*)$")
# Stop expectation at these
STOP_HEADERS = re.compile(
    r"^(User \d+:|Turn \d+ \(|Expected |Pass criteria|Script \(|Purpose:|"
    r"MYLA Thread \d+|MYLA Validation Thread \d+|LUNA Thread \d+|NURI Thread \d+|"
    r"Nuri validation|Myla validation|SYSTEM Thread \d+)",
    re.IGNORECASE,
)


def extract_quoted(s: str) -> str:
    """Extract content inside double quotes if present, else strip and return."""
    s = s.strip()
    if s.startswith('"') and s.endswith('"') and len(s) >= 2:
        return s[1:-1].replace('""', '"').strip()
    return s


def parse_extracted(text: str) -> list[dict]:
    pairs = []
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        query = None
        # User N: "..." or Turn N (User ...): "..."
        if USER_LINE.match(line):
            query = extract_quoted(USER_LINE.match(line).group(1).strip())
        elif TURN_LINE.match(line):
            query = extract_quoted(TURN_LINE.match(line).group(1).strip())
        if query is not None:
            i += 1
            expectation_lines = []
            while i < len(lines):
                ln = lines[i]
                if STOP_HEADERS.match(ln) and not (
                    ln.strip().startswith("Expected ")
                    or ln.strip().startswith("Expected:")
                ):
                    break
                m = EXPECTED_START.match(ln) or EXPECTED_GENERIC.match(ln)
                if m:
                    # EXPECTED_START has group(1)=avatar, group(2)=text; EXPECTED_GENERIC has group(1)=text
                    if EXPECTED_START.match(ln):
                        expectation_lines.append((m.group(2) or "").strip())
                    else:
                        expectation_lines.append((m.group(1) or "").strip())
                    i += 1
                    while i < len(lines):
                        next_ln = lines[i]
                        if STOP_HEADERS.match(next_ln):
                            break
                        expectation_lines.append(next_ln.strip())
                        i += 1
                    exp_text = " ".join(expectation_lines).strip()
                    if exp_text and query:
                        pairs.append({"query": query, "expectations": exp_text})
                    break
                i += 1
            continue
        i += 1
    return pairs


def main():
    if EXTRACTED_PATH.exists():
        text = EXTRACTED_PATH.read_text(encoding="utf-8")
    elif DOCX_PATH.exists():
        from app.services.file_text_extract import extract_text_from_docx
        text = extract_text_from_docx(DOCX_PATH.read_bytes())
        EXTRACTED_PATH.write_text(text, encoding="utf-8")
        print(f"Extracted docx to {EXTRACTED_PATH} ({len(text)} chars).")
    else:
        print(f"Missing {EXTRACTED_PATH} and {DOCX_PATH}. Place doc or run extraction first.")
        return 1
    pairs = parse_extracted(text)
    print(f"Extracted {len(pairs)} query/expectation pairs.")
    if not pairs:
        return 1
    # Write YAML: list of { query, expectations }
    OUT_YAML_PATH.parent.mkdir(parents=True, exist_ok=True)
    data = {"name": "NEURO Training (Myla + Luna + Nuri + System)", "queries": pairs}
    with open(OUT_YAML_PATH, "w", encoding="utf-8") as f:
        f.write("# Auto-generated from NEURO World Training Documentation. Do not edit by hand.\n")
        yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
    print(f"Wrote {OUT_YAML_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
