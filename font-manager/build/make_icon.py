# build/make_icon.py - generate 256x256 app icon and convert to ico
# Usage: python build/make_icon.py
from PIL import Image, ImageDraw, ImageFont
import os
import math

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_PNG = os.path.join(OUT_DIR, "icon-source.png")
ICON_ICO = os.path.join(OUT_DIR, "icon.ico")

SIZE = 512

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# Apple-white rounded square background
margin = 32
radius = 110
bg_color = (255, 255, 255, 255)
d.rounded_rectangle([margin, margin, SIZE - margin, SIZE - margin],
                    radius=radius, fill=bg_color,
                    outline=(0, 0, 0, 30), width=2)
# subtle inner border
d.rounded_rectangle([margin, margin, SIZE - margin, SIZE - margin],
                    radius=radius, outline=(220, 220, 225, 255), width=4)

# Blue "A" letter (large, central) representing typography
blue = (0, 122, 255, 255)
# Try system fonts that exist on Windows
font_path = r"C:\Windows\Fonts\segoeuib.ttf"
if not os.path.exists(font_path):
    font_path = r"C:\Windows\Fonts\arial.ttf"
try:
    font = ImageFont.truetype(font_path, 280)
except Exception:
    font = ImageFont.load_default()

# Draw "Aa" centered
text = "Aa"
# get text bbox to center
bbox = d.textbbox((0, 0), text, font=font)
tw = bbox[2] - bbox[0]
th = bbox[3] - bbox[1]
tx = (SIZE - tw) // 2 - bbox[0]
ty = (SIZE - th) // 2 - bbox[1] - 10
d.text((tx, ty), text, font=font, fill=blue)

# Decorative small color dots (typography palette)
d.ellipse([80, 90, 120, 130], fill=(255, 159, 10, 255))   # orange
d.ellipse([400, 90, 440, 130], fill=(52, 199, 89, 255))   # green
d.ellipse([80, 392, 120, 432], fill=(255, 99, 132, 255))  # pink
d.ellipse([400, 392, 440, 432], fill=(175, 82, 222, 255)) # purple

# Save source PNG
img.save(SOURCE_PNG, format="PNG")

# Convert to ico (multi-size)
img_rgba = img.convert("RGBA")
img_rgba.save(ICON_ICO, format="ICO",
              sizes=[(16, 16), (32, 32), (48, 48),
                     (64, 64), (128, 128), (256, 256)])

print(f"Generated: {SOURCE_PNG}")
print(f"Generated: {ICON_ICO}")
