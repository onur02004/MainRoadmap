import socket
import board
import neopixel

NUM_LEDS = 60
UDP_PORT = 12345

pixels = neopixel.NeoPixel(
    board.D18,
    NUM_LEDS,
    brightness=0.35,
    auto_write=False,
    pixel_order=neopixel.RGB
)

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(("0.0.0.0", UDP_PORT))

print(f"Listening for UDP frames on port {UDP_PORT}...")

while True:
    data, addr = sock.recvfrom(2048)  # 180 bytes expected
    if len(data) < NUM_LEDS * 3:
        continue

    # Convert bytes → LED tuples
    for i in range(NUM_LEDS):
        r = data[i*3 + 0]
        g = data[i*3 + 1]
        b = data[i*3 + 2]
        pixels[i] = (r, g, b)

    pixels.show()
