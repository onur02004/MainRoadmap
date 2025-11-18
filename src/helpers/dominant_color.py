#!/usr/bin/env python3
import sys
import io
import json
import requests
from PIL import Image


def dominant_color_from_image(img, sample_size=(50, 50)):
    """
    Verilen PIL.Image nesnesi için baskın rengi döndürür (r, g, b).
    Resmi önce küçük bir boyuta indirir, sonra en sık geçen rengi alır.
    """
    # Performans için küçült
    img_small = img.resize(sample_size)
    img_small = img_small.convert("RGB")

    # Piksel sayısı = sample_size[0] * sample_size[1]
    colors = img_small.getcolors(maxcolors=sample_size[0] * sample_size[1])
    if not colors:
        return None

    # En çok tekrar eden rengi seç
    colors.sort(reverse=True, key=lambda x: x[0])
    _, (r, g, b) = colors[0]
    return (r, g, b)


def get_region(img, rel_cx, rel_cy, rel_box_size=0.3):
    """
    resmin göreli merkez koordinatına (rel_cx, rel_cy) göre bir bölge (crop) döndürür.
    rel_cx, rel_cy: 0..1 arası (ör: 0.0 sol, 1.0 sağ; 0.0 üst, 1.0 alt)
    rel_box_size: kutunun genişlik/yükseklik oranı (ör: 0.3 => resmin %30'u)
    """
    w, h = img.size
    box_w = int(w * rel_box_size)
    box_h = int(h * rel_box_size)

    cx = int(w * rel_cx)
    cy = int(h * rel_cy)

    left = max(0, cx - box_w // 2)
    upper = max(0, cy - box_h // 2)
    right = min(w, left + box_w)
    lower = min(h, upper + box_h)

    return img.crop((left, upper, right, lower))


def get_colors_for_image(image_url: str):
    """
    Overall + köşeler + merkez için renkleri hesaplar.
    Dönüş:
    {
      "overall": "#rrggbb",
      "points": {
        "top_left": "#rrggbb",
        "top_right": "#rrggbb",
        "bottom_left": "#rrggbb",
        "bottom_right": "#rrggbb",
        "center": "#rrggbb"
      }
    }
    """
    # 1) Görseli indir
    resp = requests.get(image_url, timeout=10)
    resp.raise_for_status()

    # 2) Pillow ile aç
    img = Image.open(io.BytesIO(resp.content)).convert("RGB")

    # 3) Overall dominant color (tüm resim)
    overall_rgb = dominant_color_from_image(img, sample_size=(50, 50))
    if overall_rgb is None:
        overall_hex = None
    else:
        r, g, b = overall_rgb
        overall_hex = f"#{r:02x}{g:02x}{b:02x}"

    # 4) Region noktaları (relative merkez koordinatları)
    regions = {
        "top_left": (0.15, 0.15),
        "top_right": (0.85, 0.15),
        "bottom_left": (0.15, 0.85),
        "bottom_right": (0.85, 0.85),
        "center": (0.5, 0.5),
    }

    points_hex = {}
    for name, (rel_cx, rel_cy) in regions.items():
        region_img = get_region(img, rel_cx, rel_cy, rel_box_size=0.3)
        rgb = dominant_color_from_image(region_img, sample_size=(30, 30))
        if rgb is None:
            points_hex[name] = None
        else:
            r, g, b = rgb
            points_hex[name] = f"#{r:02x}{g:02x}{b:02x}"

    return {
        "overall": overall_hex,
        "points": points_hex,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("ERROR: Missing image URL", file=sys.stderr)
        sys.exit(1)

    url = sys.argv[1]

    try:
        data = get_colors_for_image(url)
        # Sadece JSON çıktısı veriyoruz
        print(json.dumps(data))
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(2)
