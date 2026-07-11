# 生成网络管家图标（PNG + ICO）
from PIL import Image, ImageDraw, ImageFilter
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

def make_icon(size=512):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = size // 16
    # 背景圆角矩形（蓝色渐变模拟，用纯蓝+亮蓝叠加）
    rect = [pad, pad, size - pad, size - pad]
    r = size // 5
    # 阴影
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([pad+2, pad+6, size-pad+2, size-pad+6], radius=r, fill=(0,0,0,40))
    shadow = shadow.filter(ImageFilter.GaussianBlur(size//40))
    img.alpha_composite(shadow)
    # 主背景
    d.rounded_rectangle(rect, radius=r, fill=(0, 122, 255, 255))
    # 亮蓝高光（左上）
    hl = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hl)
    hd.rounded_rectangle(rect, radius=r, fill=(90, 200, 250, 90))
    # 用渐变裁剪：从顶部渐隐
    grad = Image.new("L", (size, size), 0)
    gd = ImageDraw.Draw(grad)
    for y in range(rect[1], size//2):
        alpha = int(255 * (1 - (y - rect[1]) / max(1, size//2 - rect[1])))
        gd.line([rect[0], y, rect[2], y], fill=alpha)
    hl.putalpha(grad)
    img.alpha_composite(hl)
    # 信号弧线（三层）
    cx, cy = size//2, int(size*0.55)
    d2 = ImageDraw.Draw(img)
    line_w = max(2, size//48)
    # 最外层弧（淡）
    d2.arc([cx-size//3, cy-size//3, cx+size//3, cy+size//3], start=200, end=340, fill=(255,255,255,80), width=line_w)
    # 中层弧
    d2.arc([cx-size//4, cy-size//4, cx+size//4, cy+size//4], start=200, end=340, fill=(255,255,255,160), width=line_w)
    # 中心点
    dot_r = max(4, size//28)
    d2.ellipse([cx-dot_r, cy-dot_r, cx+dot_r, cy+dot_r], fill=(255,255,255,255))
    return img

if __name__ == "__main__":
    img = make_icon(512)
    png_path = os.path.join(OUT_DIR, "icon-source.png")
    img.save(png_path, "PNG")
    # 转 ICO
    ico_img = img.convert("RGBA")
    ico_path = os.path.join(OUT_DIR, "icon.ico")
    ico_img.save(ico_path, format="ICO", sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
    print("OK", png_path, ico_path)
