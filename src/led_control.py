#!/usr/bin/env python3
# src/led_control.py
import sys
import os
import time
import platform

# 1. DİNAMİK AYARLAR (Web arayüzünden/veritabanından gelen veriler)
# Eğer veritabanından veri gelmezse senin kodundaki varsayılanları (200 LED, GPIO 18) baz alır.
LED_COUNT = int(os.environ.get("LED_PIXELS", "200"))
LED_PIN_NUM = int(os.environ.get("LED_PIN", "18"))

# İşletim sistemi kontrolü (Windows ise NeoPixel yükleyip çökmez)
IS_WINDOWS = os.name == 'nt' or platform.system() == 'Windows'

pixels = None

if not IS_WINDOWS:
    try:
        import board
        import neopixel
        
        # Kodun içindeki GPIO pin numarasını board nesnesine eşleme hilesi
        pin_map = {18: board.D18, 12: board.D12, 13: board.D13, 19: board.D19}
        target_pin = pin_map.get(LED_PIN_NUM, board.D18) # Tanımsızsa D18 seçer
        
        # Senin orijinal şerit tanımın (Güvenli parlaklık seviyesi %25)
        pixels = neopixel.NeoPixel(
            target_pin, 
            LED_COUNT, 
            brightness=0.25, 
            auto_write=False, 
            pixel_order=neopixel.GRB
        )
    except ImportError:
        print("[LED_WARN] NeoPixel kütüphaneleri yüklenemedi, simülasyon moduna geçiliyor.")
        IS_WINDOWS = True

def ambient_yak_kismi(renk):
    """Senin orijinal lojiğin: İlk 32 LED'i kapatır, geri kalanları istenen renkte yakar"""
    if IS_WINDOWS:
        print(f"[SIMÜLASYON] -> İlk 32 LED kapatıldı (0-31).")
        print(f"[SIMÜLASYON] -> 32. LED'den {LED_COUNT}. LED'e kadar şu renk basıldı: RGB{renk}")
        # Windows terminalinde rengi kabaca görmen için küçük bir hile:
        print(f"[SIMÜLASYON] -> Görsel Renk Tonu: \033[48;2;{renk[0]};{renk[1]};{renk[2]}m    \033[0m")
        return

    # Gerçek Raspberry Pi üzerinde çalışacak kodlar:
    # 1. İlk 32 LED'i tamamen söndür (0'dan 31'e kadar)
    for i in range(min(32, LED_COUNT)):
        pixels[i] = (0, 0, 0)
        
    # 2. 32. LED'den başlayarak sonuna kadar renk ver
    if LED_COUNT > 32:
        for i in range(32, LED_COUNT):
            pixels[i] = renk
        
    # Değişiklikleri şeride gönder
    pixels.show()

def main():
    if len(sys.argv) < 2:
        print("[LED_ERROR] Herhangi bir eylem belirtilmedi.")
        sys.exit(1)

    action = sys.argv[1]

    # Web arayüzünde 'On' (Aç) butonuna basıldığında senin sıcak amber rengini yakar
    if action == "on":
        print("[LED_ACTION] Ambient ışık açılıyor...")
        ambient_yak_kismi((255, 100, 20)) # Orijinal sıcak amber rengin

    # Web arayüzünde 'Off' (Kapat) butonuna basıldığında her şeyi söndürür
    elif action == "off":
        print("[LED_ACTION] Işıklar söndürülüyor.")
        if not IS_WINDOWS:
            pixels.fill((0, 0, 0))
            pixels.show()

    # Renk paletinden (Color Picker) anlık seçtiğin rengi 32. LED'den sonrasına basar
    elif action == "set_color":
        if len(sys.argv) < 5:
            sys.exit(1)
        r, g, b = int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
        print(f"[LED_ACTION] Kullanıcı özel renk atadı.")
        ambient_yak_kismi((r, g, b))

    # Kumandadan parlaklık kaydırıldığında (0-255 arası değer gelir)
    elif action == "set_brightness":
        if len(sys.argv) < 3:
            sys.exit(1)
        # Gelen 0-255 arası değeri NeoPixel'in istediği 0.0 - 1.0 arasına oranlıyoruz
        val = int(sys.argv[2])
        target_brightness = (val / 255.0) * 0.25 # Senin %25'lik güvenli sınırını aşmamak için çarptık
        print(f"[LED_ACTION] Parlaklık güncellendi: {target_brightness:.2f}")
        if not IS_WINDOWS:
            pixels.brightness = target_brightness
            pixels.show()

    elif action == "wave":
        print("[LED_ACTION] Dalga efekti (Gelecekte yazılacak).")

if __name__ == "__main__":
    main()