"""Generate personalised event invitation PNGs over the Marsol branded template.

The template (invitation_template.png) is 2000x2500 portrait. We overlay
dynamic text — event name, guest line, date+time, address — using fonts that
support Azerbaijani diacritics (FreeSans / FreeSansBold / FreeSansOblique).
The rendered PNG is uploaded to Cloudinary; URL stored on the invitation.
"""

from __future__ import annotations

import io
import os
from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw, ImageFont

ASSETS_DIR = Path(__file__).resolve().parent / "assets"
TEMPLATE_PATH = ASSETS_DIR / "invitation_template.png"

# Font candidates (must support Azerbaijani diacritics: ə ş ı ğ ö ü ç İ Ə Ş Ç Ğ Ü Ö)
FONT_REGULAR = "/usr/share/fonts/truetype/freefont/FreeSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf"
FONT_ITALIC = "/usr/share/fonts/truetype/freefont/FreeSansOblique.ttf"
FONT_BOLDITAL = "/usr/share/fonts/truetype/freefont/FreeSansBoldOblique.ttf"

NAVY = (29, 50, 91)        # Marsol dark-navy heading colour
INK = (40, 40, 50)         # Body ink (slightly softer than pure black)

# Vertical anchor lines (px) on the 2000x2500 template:
EVENT_TITLE_Y = 720   # large event title (replaces "Tədbirin adı")
BODY_BLOCK_Y = 980    # "Hörmətli ... görüşünə dəvət edirik."
DATETIME_Y = 1980     # tarix və saat (right side, bold italic)
LOCATION_Y = 2150     # Ünvan : Məkanın adı (right side, bold italic)


def _font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def _draw_centered(draw: ImageDraw.ImageDraw, text: str, y: int, font: ImageFont.FreeTypeFont,
                   fill, img_w: int, max_width: Optional[int] = None) -> int:
    """Draw text centered horizontally at (img_w/2, y). Returns next y."""
    if not text:
        return y
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    if max_width and w > max_width:
        # auto-shrink font size until it fits (down to 60% of original size)
        size = font.size
        while w > max_width and size > int(font.size * 0.6):
            size -= 4
            font = _font(font.path, size)
            bbox = draw.textbbox((0, 0), text, font=font)
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
    x = (img_w - w) // 2
    draw.text((x, y), text, fill=fill, font=font)
    return y + h


def _wrap_text(text: str, font: ImageFont.FreeTypeFont, draw: ImageDraw.ImageDraw, max_width: int) -> list[str]:
    """Naive word-wrap by px width."""
    words = text.split(" ")
    lines: list[str] = []
    current = ""
    for w in words:
        candidate = (current + " " + w).strip()
        bb = draw.textbbox((0, 0), candidate, font=font)
        if (bb[2] - bb[0]) <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = w
    if current:
        lines.append(current)
    return lines


def render_invitation_png(
    guest_name: str,
    event_name: str,
    event_date: str,    # display string, eg "23/06/2026"
    event_time: Optional[str],
    event_location: Optional[str],
) -> bytes:
    """Render the personalised invitation PNG and return raw bytes."""
    if not TEMPLATE_PATH.exists():
        raise FileNotFoundError(f"Template not found at {TEMPLATE_PATH}")

    bg = Image.open(TEMPLATE_PATH).convert("RGB")
    img_w, img_h = bg.size
    draw = ImageDraw.Draw(bg)

    # --- 1. Event title (large, navy, bold) ----------------------------------
    title_font = _font(FONT_BOLD, 150)
    _draw_centered(
        draw, event_name or "Tədbirin adı",
        y=EVENT_TITLE_Y, font=title_font, fill=NAVY,
        img_w=img_w, max_width=int(img_w * 0.85),
    )

    # --- 2. Body block (3 lines, italic, ink) --------------------------------
    italic_font = _font(FONT_ITALIC, 78)
    bold_ital_font = _font(FONT_BOLDITAL, 78)

    safe_guest = (guest_name or "Qonağımız").strip()
    line1 = f"Hörmətli {safe_guest},"
    line2 = "sizi region partnyorları ilə baş tutacaq"
    # Highlight the event title in line 3 by drawing it in bold-italic
    line3_prefix = '"'
    line3_event = (event_name or "Tədbirin adı")
    line3_suffix = '" görüşünə dəvət edirik.'

    y = BODY_BLOCK_Y
    y = _draw_centered(draw, line1, y, italic_font, INK, img_w) + 20
    y = _draw_centered(draw, line2, y, italic_font, INK, img_w, max_width=int(img_w * 0.85)) + 20

    # Render line3 with the event title bolded inline (and word-wrapped if needed)
    full_line3 = f'{line3_prefix}{line3_event}{line3_suffix}'
    bb = draw.textbbox((0, 0), full_line3, font=italic_font)
    if (bb[2] - bb[0]) <= int(img_w * 0.88):
        # fits on one line: measure each part to layout
        w1 = draw.textbbox((0, 0), line3_prefix, font=italic_font)[2]
        w2 = draw.textbbox((0, 0), line3_event, font=bold_ital_font)[2]
        w3 = draw.textbbox((0, 0), line3_suffix, font=italic_font)[2]
        total_w = w1 + w2 + w3
        x = (img_w - total_w) // 2
        draw.text((x, y), line3_prefix, fill=INK, font=italic_font)
        draw.text((x + w1, y), line3_event, fill=NAVY, font=bold_ital_font)
        draw.text((x + w1 + w2, y), line3_suffix, fill=INK, font=italic_font)
    else:
        # fallback: render the whole line in italic, auto-shrink to fit
        _draw_centered(draw, full_line3, y, italic_font, INK, img_w, max_width=int(img_w * 0.85))

    # --- 3. Date + time (bottom right area, bold) ----------------------------
    datetime_text = event_date or ""
    if event_time:
        datetime_text = f"{datetime_text}  {event_time}" if datetime_text else event_time
    dt_font = _font(FONT_BOLD, 72)
    _draw_centered(
        draw, datetime_text or "tarix və saat",
        y=DATETIME_Y, font=dt_font, fill=NAVY,
        img_w=img_w, max_width=int(img_w * 0.85),
    )

    # --- 4. Location (bottom-right, bold) ------------------------------------
    loc_text = f"Ünvan : {event_location}" if event_location else "Ünvan : Məkanın adı"
    loc_font = _font(FONT_BOLD, 64)
    _draw_centered(
        draw, loc_text,
        y=LOCATION_Y, font=loc_font, fill=NAVY,
        img_w=img_w, max_width=int(img_w * 0.85),
    )

    buf = io.BytesIO()
    bg.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def render_invitation_to_file(out_path: str, **kwargs) -> str:
    data = render_invitation_png(**kwargs)
    with open(out_path, "wb") as f:
        f.write(data)
    return out_path
