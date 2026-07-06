"""生成 diff-checker 图标各尺寸"""
import sys
from pathlib import Path
from PIL import Image

src = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "icon-source.png"
out_dir = src.parent

img = Image.open(src).convert("RGBA")

# 生成不同尺寸的 PNG
sizes_png = [192, 512]
for s in sizes_png:
    resized = img.resize((s, s), Image.LANCZOS)
    resized.save(out_dir / f"icon-{s}.png", "PNG")
    print(f"  -> icon-{s}.png")

# 180x180 用于 apple-touch-icon
img.resize((180, 180), Image.LANCZOS).save(out_dir / "icon-180.png", "PNG")
print("  -> icon-180.png")

# 生成 favicon.ico（多尺寸）
ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
ico_imgs = [img.resize(s, Image.LANCZOS) for s in ico_sizes]
ico_imgs[0].save(
    out_dir / "favicon.ico",
    format="ICO",
    sizes=ico_sizes,
)
print("  -> favicon.ico")
print("Done")
