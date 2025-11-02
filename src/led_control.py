import sys
import board
import neopixel

# WS2812 setup
pixel_pin = board.D18
num_pixels = 8  # adjust for your strip
pixels = neopixel.NeoPixel(pixel_pin, num_pixels, brightness=0.3, auto_write=True)

def set_color(r, g, b):
    pixels.fill((r, g, b))

def rainbow_cycle(wait=0.01):
    import time
    def wheel(pos):
        if pos < 85:
            return (pos * 3, 255 - pos * 3, 0)
        elif pos < 170:
            pos -= 85
            return (255 - pos * 3, 0, pos * 3)
        else:
            pos -= 170
            return (0, pos * 3, 255 - pos * 3)

    for j in range(255):
        for i in range(num_pixels):
            pixel_index = (i * 256 // num_pixels) + j
            pixels[i] = wheel(pixel_index & 255)
        pixels.show()
        time.sleep(wait)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: led_control.py <mode> [args]")
        sys.exit(1)

    mode = sys.argv[1]

    if mode == "color":
        r, g, b = map(int, sys.argv[2:5])
        set_color(r, g, b)
    elif mode == "rainbow":
        rainbow_cycle()
