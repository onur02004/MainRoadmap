#!/usr/bin/env python3
# led_control.py
# Debug-friendly LED control that works on Windows (no hardware).

import os
import sys
import json
import time

DRY_RUN = False
pixels = 60
num_pixels = int(os.getenv("LED_PIXELS", "8"))
pin_env = os.getenv("LED_PIN", "D18")  # informational only in DRY_RUN

pixel_pin = board.D18
num_pixels = 60  # <-- set to 60
pixels = neopixel.NeoPixel(
    pixel_pin,
    num_pixels,
    brightness=0.3,
    auto_write=False  # important: we'll call show() manually
)

# Try to import neopixel stack; fall back to dry-run if unavailable
try:
    import board
    import neopixel
    # map env pin -> board attr if set, default D18
    pixel_pin = getattr(board, pin_env, getattr(board, "D18", None))
    pixels = neopixel.NeoPixel(pixel_pin, num_pixels, brightness=0.3, auto_write=True)
except Exception as e:
    DRY_RUN = True

def log(msg, **extra):
    # single-line JSON so it's easy to read in Node stdout
    payload = {"ok": True, "dryRun": DRY_RUN, "msg": msg}
    if extra:
        payload.update(extra)
    print(json.dumps(payload, ensure_ascii=False))

def err(msg):
    payload = {"ok": False, "dryRun": DRY_RUN, "error": msg}
    print(json.dumps(payload, ensure_ascii=False), file=sys.stderr)

def set_color(r, g, b):
    if DRY_RUN:
        log("set_color (dry-run)", r=r, g=g, b=b)
        return
    pixels.fill((r, g, b))

def set_brightness(value):
    # value: 0–255
    v = max(0, min(255, int(value)))
    if DRY_RUN:
        log("set_brightness (dry-run)", value=v)
        return
    # neopixel brightness is 0..1
    brightness = v / 255.0
    try:
        pixels.brightness = brightness
        pixels.show()
    except Exception:
        # Some builds require re-creating with new brightness
        pass

def turn_on():
    # “on” here just means ensure LEDs are powered/showing last color
    if DRY_RUN:
        log("on (dry-run)")
        return
    pixels.show()

def turn_off():
    if DRY_RUN:
        log("off (dry-run)")
        return
    pixels.fill((0, 0, 0))
    pixels.show()

def wave(speed=0.5, steps=32):
    # keep this SHORT so the Node process returns quickly
    # speed just affects the sleep time a bit
    wait = max(0.0, float(speed)) * 0.02  # 0.0.. ~0.1
    if DRY_RUN:
        log("wave (dry-run one-shot)", speed=speed, steps=steps)
        return
    for j in range(steps):
        for i in range(num_pixels):
            # simple 1D moving gradient
            r = (i * 5 + j * 8) % 256
            g = (i * 3 + j * 5) % 256
            b = (i * 2 + j * 13) % 256
            pixels[i] = (r, g, b)
        pixels.show()
        time.sleep(wait)

def main(argv):
    if len(argv) < 2:
        err("Usage: led_control.py <action> [args...]")
        return 2

    action = argv[1].strip().lower()

    try:
        if action == "on":
            turn_on()
            log("received", action=action)
            return 0

        if action == "off":
            turn_off()
            log("received", action=action)
            return 0

        if action == "set_color":
            if len(argv) < 5:
                err("set_color requires r g b")
                return 3
            r, g, b = map(int, argv[2:5])
            r = max(0, min(255, r))
            g = max(0, min(255, g))
            b = max(0, min(255, b))
            set_color(r, g, b)
            log("received", action=action, r=r, g=g, b=b)
            return 0

        if action == "set_brightness":
            if len(argv) < 3:
                err("set_brightness requires value (0..255)")
                return 3
            value = int(argv[2])
            set_brightness(value)
            log("received", action=action, value=value)
            return 0

        if action == "wave":
            # optional speed arg
            speed = float(argv[2]) if len(argv) >= 3 else 0.5
            wave(speed=speed, steps=32)
            log("received", action=action, speed=speed)
            return 0

        if action == "hue":
            err("hue not implemented")
            return 4

        err(f"unknown action: {action}")
        return 5

    except Exception as e:
        err(f"exception: {type(e).__name__}: {e}")
        return 7

if __name__ == "__main__":
    sys.exit(main(sys.argv))

def apply_frame_from_line(line: str):
    """
    line format: 'r,g,b;r,g,b;...'(one triplet per LED)
    """
    line = line.strip()
    if not line:
        return

    parts = line.split(";")
    for i, part in enumerate(parts):
        if i >= num_pixels:
            break
        try:
            r_str, g_str, b_str = part.split(",")
            r = int(r_str)
            g = int(g_str)
            b = int(b_str)
            pixels[i] = (r, g, b)
        except ValueError:
            # skip malformed triplets
            continue

    pixels.show()
