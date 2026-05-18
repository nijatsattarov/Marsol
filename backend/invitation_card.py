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
    body_template: Optional[str] = None,  # multi-line template with {placeholders}
) -> bytes:
    """Render the personalised invitation PNG and return raw bytes.

    If `body_template` is provided, it's used as the message body — newlines
    split into rows, and `"{event_name}"` segments are auto-bolded in
    bold-italic navy. Supported placeholders: {guest_name}, {event_name},
    {event_date}, {event_time}, {event_location}.
    """
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

    # --- 2. Body block (multi-line italic, ink, with {event_name} bolded) ----
    italic_font = _font(FONT_ITALIC, 72)
    bold_ital_font = _font(FONT_BOLDITAL, 72)

    safe_guest = (guest_name or "Qonağımız").strip()
    if body_template:
        body = body_template
    else:
        body = (
            "Hörmətli {guest_name},\n"
            "sizi region partnyorları ilə baş tutacaq\n"
            '"{event_name}" görüşünə dəvət edirik.'
        )
    # Substitute placeholders
    body = (
        body
        .replace("{guest_name}", safe_guest)
        .replace("{event_date}", event_date or "")
        .replace("{event_time}", event_time or "")
        .replace("{event_location}", event_location or "")
    )
    event_token = event_name or "Tədbir"

    y = BODY_BLOCK_Y
    for raw_line in body.split("\n"):
        line = raw_line.strip()
        if not line:
            y += 30
            continue
        # Split by {event_name} marker so we can bold-italic that segment
        if "{event_name}" in line:
            parts = line.split("{event_name}")
            # auto-shrink if total width too large
            font_r = italic_font
            font_b = bold_ital_font
            def _total(pf_r, pf_b):
                tot = 0
                for i, p in enumerate(parts):
                    if i > 0:
                        tot += draw.textbbox((0, 0), event_token, font=pf_b)[2]
                    tot += draw.textbbox((0, 0), p, font=pf_r)[2]
                return tot
            tw = _total(font_r, font_b)
            max_w = int(img_w * 0.88)
            while tw > max_w and font_r.size > 40:
                font_r = _font(FONT_ITALIC, font_r.size - 4)
                font_b = _font(FONT_BOLDITAL, font_b.size - 4)
                tw = _total(font_r, font_b)
            x = (img_w - tw) // 2
            for i, p in enumerate(parts):
                if i > 0:
                    draw.text((x, y), event_token, fill=NAVY, font=font_b)
                    x += draw.textbbox((0, 0), event_token, font=font_b)[2]
                draw.text((x, y), p, fill=INK, font=font_r)
                x += draw.textbbox((0, 0), p, font=font_r)[2]
            y += font_r.size + 26
        else:
            y = _draw_centered(draw, line, y, italic_font, INK, img_w, max_width=int(img_w * 0.85)) + 18

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
