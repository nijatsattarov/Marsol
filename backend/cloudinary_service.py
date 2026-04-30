"""Cloudinary helper — server-side uploads.

Configuration is read from environment at import time. We expose two simple
functions used by the API layer:

- ``upload_file(file_bytes, filename, folder, resource_type)``: streams bytes
  to Cloudinary and returns ``(secure_url, public_id, resource_type, format,
  bytes, width, height)``.
- ``delete_asset(public_id, resource_type)``: removes an asset.

Resource type detection is automatic for documents (``raw``), images and
videos based on the file extension.
"""

from __future__ import annotations

import io
import logging
import mimetypes
import os
from typing import Any, Dict, Tuple

import cloudinary
import cloudinary.uploader

logger = logging.getLogger(__name__)

cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True,
)

IMAGE_EXTS = {"jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff", "ico", "heic", "heif"}
VIDEO_EXTS = {"mp4", "mov", "avi", "mkv", "webm", "wmv", "flv", "mpeg", "mpg", "m4v"}


def detect_resource_type(filename: str) -> str:
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
    if ext in IMAGE_EXTS:
        return "image"
    if ext in VIDEO_EXTS:
        return "video"
    return "raw"  # everything else (pdf, docx, xlsx, txt, zip ...)


def upload_file(file_bytes: bytes, filename: str, folder: str, resource_type: str | None = None) -> Dict[str, Any]:
    if not os.environ.get("CLOUDINARY_CLOUD_NAME"):
        raise RuntimeError("Cloudinary konfiqurasiya olunmayıb (.env-də CLOUDINARY_* dəyişənlərini əlavə edin)")
    rt = resource_type or detect_resource_type(filename)
    safe_folder = folder.strip("/") or "marsol/uploads"
    # Build a clean public_id stem from the original filename so the asset URL
    # is readable; Cloudinary will append a unique suffix when needed.
    stem = os.path.splitext(os.path.basename(filename))[0] or "file"
    safe_stem = "".join(c if c.isalnum() or c in "-_" else "_" for c in stem)[:80]
    try:
        result = cloudinary.uploader.upload(
            io.BytesIO(file_bytes),
            folder=safe_folder,
            resource_type=rt,
            public_id=safe_stem,
            unique_filename=True,
            overwrite=False,
        )
        return {
            "url": result.get("secure_url"),
            "public_id": result.get("public_id"),
            "resource_type": result.get("resource_type", rt),
            "format": result.get("format"),
            "bytes": result.get("bytes"),
            "width": result.get("width"),
            "height": result.get("height"),
            "original_filename": result.get("original_filename") or filename,
            "mime_type": mimetypes.guess_type(filename)[0],
        }
    except Exception as e:
        logger.exception("Cloudinary upload failed: %s", e)
        raise


def delete_asset(public_id: str, resource_type: str = "image") -> bool:
    try:
        result = cloudinary.uploader.destroy(public_id, resource_type=resource_type, invalidate=True)
        return result.get("result") == "ok"
    except Exception as e:
        logger.warning("Cloudinary delete failed for %s: %s", public_id, e)
        return False
