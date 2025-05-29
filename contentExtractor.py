#!/usr/bin/env python3

import os
import re

EXCLUDE_DIRS = {'_site', '.git', 'node_modules', '.jekyll-cache', 'versions', 'utilities', 'topicTrees', 'support/local'}
OUTPUT_FILE = "compressed_context.txt"

EXCLUDE_FILES = {'README.md', 'LICENSE.md', 'posts.md', 'localInstall.md', 'about.md', 'releaseNotes.md'}  # Add filenames (not paths) you want to ignore

def collect_markdown_files(root_dir):
    markdown_files = []
    for dirpath, dirnames, filenames in os.walk(root_dir):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for filename in filenames:
            if filename.endswith('.md') and filename not in EXCLUDE_FILES and not filename.startswith('_'):
                full_path = os.path.join(dirpath, filename)
                markdown_files.append(full_path)
    return markdown_files

def clean_markdown(text):
    # Remove YAML frontmatter
    text = re.sub(r'^---.*?---\s*', '', text, flags=re.DOTALL)

    # Remove HTML comments
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)

    # Remove <script> tags and their entire contents (multiline-safe)
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.IGNORECASE | re.DOTALL)

    # Normalize all tag contents to be on one line (for easier matching)
    text = re.sub(r'>\s+<', '><', text)

    # Convert multiline HTML headings to markdown-style equivalents
    text = re.sub(r'<h1[^>]*>(.*?)</h1>', r'# \1', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'<h2[^>]*>(.*?)</h2>', r'## \1', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'<h3[^>]*>(.*?)</h3>', r'### \1', text, flags=re.IGNORECASE | re.DOTALL)

    # Replace <br> and <br/> with newline
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)

    # Tags to strip but preserve inner text
    strip_tags = ['div', 'tr', 'td', 'p', 'table', 'i', 'small', 'span', 'script']
    for tag in strip_tags:
        # Remove opening and closing tags even if they span lines
        text = re.sub(fr'</?{tag}[^>]*>', '', text, flags=re.IGNORECASE | re.DOTALL)

    # Remove any other leftover HTML tags (safeguard)
    text = re.sub(r'<[^>]+>', '', text)

    # Normalize whitespace
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()


def main():
    print("🔍 Collecting Markdown files...")
    md_files = collect_markdown_files(".")
    all_text = []

    for path in md_files:
        with open(path, "r", encoding="utf-8") as f:
            raw = f.read()
        clean = clean_markdown(raw)
        all_text.append(f"# Source: {path}\n{clean}\n")

    final_text = "\n\n".join(all_text)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(final_text)

    print(f"\n✅ Compressed content written to: {OUTPUT_FILE}")
    word_count = len(final_text.split())
    print(f"🧠 Final word count: {word_count} words")

if __name__ == "__main__":
    main()
