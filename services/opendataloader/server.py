"""Thin HTTP wrapper around opendataloader-pdf CLI for AccessIQ."""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

from flask import Flask, jsonify, request, send_file

app = Flask(__name__)

CLI = os.environ.get("ODL_CLI", "opendataloader-pdf")
MAX_BYTES = int(os.environ.get("ODL_MAX_BYTES", str(20 * 1024 * 1024)))
TIMEOUT_SEC = int(os.environ.get("ODL_TIMEOUT_SEC", "180"))


@app.get("/health")
def health():
    return jsonify({"ok": True, "engine": "opendataloader-pdf"})


def _run_convert(pdf_path: Path, output_dir: Path, formats: str) -> None:
    cmd = [
        CLI,
        str(pdf_path),
        "-o",
        str(output_dir),
        "-f",
        formats,
        "--use-struct-tree",
    ]
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=TIMEOUT_SEC,
        check=False,
    )
    if result.returncode != 0:
        err = (result.stderr or result.stdout or "opendataloader-pdf failed").strip()
        raise RuntimeError(err[:2000])


def _pick_output(output_dir: Path, stem: str, suffixes: list[str]) -> Path | None:
    for suffix in suffixes:
        candidate = output_dir / f"{stem}{suffix}"
        if candidate.exists():
            return candidate
    # Fallback: any matching extension in the directory
    for suffix in suffixes:
        matches = list(output_dir.glob(f"*{suffix}"))
        if matches:
            return matches[0]
    return None


@app.post("/api/convert")
def convert():
    if "file" not in request.files:
        return jsonify({"error": "file is required"}), 400

    formats = (request.form.get("format") or "json,html,markdown").strip()
    upload = request.files["file"]
    data = upload.read()
    if not data:
        return jsonify({"error": "empty file"}), 400
    if len(data) > MAX_BYTES:
        return jsonify({"error": f"file exceeds {MAX_BYTES} byte limit"}), 413

    work = Path(tempfile.mkdtemp(prefix="odl-"))
    try:
        stem = Path(upload.filename or "document.pdf").stem or "document"
        pdf_path = work / f"{stem}.pdf"
        pdf_path.write_bytes(data)
        output_dir = work / "out"
        output_dir.mkdir(parents=True, exist_ok=True)

        _run_convert(pdf_path, output_dir, formats)

        wanted = {part.strip().lower() for part in formats.split(",") if part.strip()}
        payload: dict[str, object] = {"formats": sorted(wanted)}

        if "json" in wanted:
            path = _pick_output(output_dir, stem, [".json"])
            payload["json"] = path.read_text(encoding="utf-8", errors="replace") if path else ""
        if "html" in wanted:
            path = _pick_output(output_dir, stem, [".html"])
            payload["html"] = path.read_text(encoding="utf-8", errors="replace") if path else ""
        if "markdown" in wanted or "md" in wanted:
            path = _pick_output(output_dir, stem, [".md", ".markdown"])
            payload["markdown"] = path.read_text(encoding="utf-8", errors="replace") if path else ""
        if "tagged-pdf" in wanted:
            # Prefer *tagged*.pdf, else any non-source pdf in output
            tagged = None
            for candidate in sorted(output_dir.glob("*.pdf")):
                name = candidate.name.lower()
                if "tagged" in name or candidate.name != pdf_path.name:
                    tagged = candidate
                    break
            if tagged is None:
                return jsonify({"error": "tagged-pdf output missing", **payload}), 500
            zip_path = work / "artifact.zip"
            with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                zf.writestr("suggested-tagged.pdf", tagged.read_bytes())
                if "json" in payload and payload["json"]:
                    zf.writestr("structure.json", str(payload["json"]))
                if "html" in payload and payload["html"]:
                    zf.writestr("structure.html", str(payload["html"]))
                if "markdown" in payload and payload["markdown"]:
                    zf.writestr("structure.md", str(payload["markdown"]))
            return send_file(
                zip_path,
                mimetype="application/zip",
                as_attachment=True,
                download_name="opendataloader-result.zip",
            )

        return jsonify(payload)
    except subprocess.TimeoutExpired:
        return jsonify({"error": f"opendataloader-pdf timed out after {TIMEOUT_SEC}s"}), 504
    except Exception as exc:  # noqa: BLE001 — surface to caller
        return jsonify({"error": str(exc)}), 500
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8095")), threaded=True)
