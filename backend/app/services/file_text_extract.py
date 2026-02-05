"""Extract plain text from uploaded PDF and DOCX for parser input."""
from io import BytesIO


def extract_text_from_pdf(content: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(BytesIO(content))
    parts = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            parts.append(text)
    return "\n\n".join(parts) if parts else ""


def extract_text_from_docx(content: bytes) -> str:
    from docx import Document
    doc = Document(BytesIO(content))
    return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())


def extract_text_from_file(content: bytes, filename: str | None, content_type: str | None) -> str:
    """Return plain text from file content. Uses UTF-8 decode for text files, or PDF/DOCX extraction."""
    name = (filename or "").lower()
    ct = (content_type or "").lower()
    if name.endswith(".pdf") or "pdf" in ct:
        return extract_text_from_pdf(content)
    if name.endswith(".docx") or "wordprocessingml" in ct or "vnd.openxmlformats" in ct:
        return extract_text_from_docx(content)
    return content.decode("utf-8", errors="replace")
