#!/usr/bin/env python3
"""Static acceptance checks for the dependency-free workout PWA."""

from __future__ import annotations

import json
import re
import struct
import sys
from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[1]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def png_dimensions(path: Path) -> tuple[int, int]:
    payload = path.read_bytes()
    require(payload[:8] == b"\x89PNG\r\n\x1a\n", f"{path.name} is not a PNG")
    require(payload[12:16] == b"IHDR", f"{path.name} has no IHDR chunk")
    return struct.unpack(">II", payload[16:24])


def main() -> int:
    index = (APP_ROOT / "index.html").read_text(encoding="utf-8")
    script = (APP_ROOT / "app.js").read_text(encoding="utf-8")
    styles = (APP_ROOT / "styles.css").read_text(encoding="utf-8")
    service_worker = (APP_ROOT / "sw.js").read_text(encoding="utf-8")
    manifest = json.loads((APP_ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))

    data_match = re.search(
        r'<script id="workout-data" type="application/json">\s*(.*?)\s*</script>',
        index,
        re.DOTALL,
    )
    require(data_match is not None, "workout JSON is missing from index.html")
    workout = json.loads(data_match.group(1))

    expected_names = [
        "Extension jambe",
        "Tirage vertical (Lat Pulldown)",
        "Curl marteau haltère",
        "Extension triceps couché",
        "Chest Fly machine (pectoraux)",
        "Planche",
        "Push-ups",
    ]
    exercises = workout["exercises"]
    require([item["name"] for item in exercises] == expected_names, "exercise order changed")
    require(len(exercises) == 7, "the workout must contain seven exercises")
    require(sum(len(item["sets"]) for item in exercises) == 19, "the workout must contain 19 sets")
    require(workout["restBetweenSets"] == 30, "set rest must be 30 seconds")
    require(workout["restBetweenExercises"] == 120, "exercise rest must be 120 seconds")

    for exercise in exercises[:5]:
        require(len(exercise["sets"]) == 3, f"{exercise['name']} must have three sets")
        require(
            all(item["target"] == "8–12 répétitions" for item in exercise["sets"]),
            f"{exercise['name']} must use 8–12 repetitions",
        )

    plank = exercises[5]
    require([item["duration"] for item in plank["sets"]] == [90, 60, 45], "plank timers changed")
    require(len(exercises[6]["sets"]) == 1, "push-ups must have one final set")
    require(exercises[6]["sets"][0]["target"] == "Maximum de répétitions", "push-ups must be maximum")

    rendered_program = json.dumps(workout, ensure_ascii=False).lower()
    require(re.search(r"\b(lb|lbs|kg|poids|weight)\b", rendered_program) is None, "a weight field or value was added")

    require('apple-mobile-web-app-capable" content="yes"' in index, "Apple standalone metadata missing")
    require('rel="apple-touch-icon"' in index, "Apple touch icon missing")
    require('rel="manifest"' in index, "manifest link missing")
    require("startRest(workout.restBetweenSets" in script, "automatic set rest trigger missing")
    require("startRest(workout.restBetweenExercises" in script, "automatic exercise rest trigger missing")
    require("localStorage" in script, "local progress persistence missing")
    require("navigator.serviceWorker.register" in script, "service worker registration missing")
    require(re.search(r"--bg:\s*#050505", styles) is not None, "black background token missing")

    require(manifest["name"] == "IZOUKINI WORKOUT", "published app name changed")
    require(manifest["display"] == "standalone", "PWA display mode must be standalone")
    require(manifest["start_url"] == "./", "PWA must open directly on the workout")
    require(manifest["background_color"] == "#050505", "manifest background must be black")
    require(manifest["theme_color"] == "#050505", "manifest theme must be black")

    cache_match = re.search(r"const APP_SHELL = \[(.*?)\];", service_worker, re.DOTALL)
    require(cache_match is not None, "service worker app shell is missing")
    cached_paths = re.findall(r'"(\./[^\"]*)"', cache_match.group(1))
    require("./index.html" in cached_paths, "index.html is not cached")
    for cached_path in cached_paths:
        relative = cached_path.removeprefix("./")
        if not relative:
            continue
        require((APP_ROOT / relative).is_file(), f"cached resource does not exist: {cached_path}")

    expected_icons = {
        "icon-180.png": (180, 180),
        "icon-192.png": (192, 192),
        "icon-512.png": (512, 512),
    }
    for icon_name, expected_size in expected_icons.items():
        require(png_dimensions(APP_ROOT / "icons" / icon_name) == expected_size, f"{icon_name} has the wrong dimensions")

    print("PASS: 7 exercises in the requested order")
    print("PASS: 19 sets with 30-second and 2-minute automatic rests")
    print("PASS: plank timers are 90, 60, and 45 seconds")
    print("PASS: no weight field or value is present")
    print("PASS: black standalone iPhone PWA metadata and offline shell are complete")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, FileNotFoundError, json.JSONDecodeError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        raise SystemExit(1)
