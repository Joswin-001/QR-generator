#!/usr/bin/env python3
"""
Reads a PDF from stdin, renders each page to PNG at the given DPI,
outputs a JSON array of base64-encoded PNG strings to stdout.

Usage: python3 pdf_render.py <dpi>
"""

import sys
import base64
import json
import fitz  # pymupdf

def main():
    dpi = int(sys.argv[1]) if len(sys.argv) > 1 else 300
    scale = dpi / 72.0

    pdf_bytes = sys.stdin.buffer.read()
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    results = []
    for page in doc:
        mat = fitz.Matrix(scale, scale)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        png_bytes = pix.tobytes("png")
        results.append(base64.b64encode(png_bytes).decode("utf-8"))

    print(json.dumps(results))

if __name__ == "__main__":
    main()
