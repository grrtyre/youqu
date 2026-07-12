"""计算器管家 · 应用图标生成
苹果白高端风格：白色圆角方块 + 蓝色 "=" 符号
输出: icon-source.png (256x256), icon.ico (多尺寸)
"""
import os
from PIL import Image, ImageDraw, ImageFilter

SIZE = 512  # 高清源图尺寸
ICON_SIZES = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

OUT_DIR = os.path.dirname(os.path.abspath(__file__))


def make_icon():
    # 透明底
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 圆角方块（带柔和阴影）
    margin = int(SIZE * 0.06)
    radius = int(SIZE * 0.22)
    rect = [margin, margin, SIZE - margin, SIZE - margin]

    # 先画一层模糊的阴影
    shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(rect, radius=radius, fill=(0, 0, 0, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=int(SIZE * 0.025)))
    img = Image.alpha_composite(img, shadow)
    draw = ImageDraw.Draw(img)

    # 主体白底
    draw.rounded_rectangle(rect, radius=radius, fill=(255, 255, 255, 255))

    # 顶部细蓝条（应用图标特征）
    top_band_h = int(SIZE * 0.06)
    top_band = [margin, margin, SIZE - margin, margin + top_band_h]
    # 用裁剪方式画顶部条
    band_img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band_img)
    bd.rounded_rectangle(rect, radius=radius, fill=(0, 122, 255, 255))
    # 再用白色遮罩下半部分
    bd.rectangle([0, margin + top_band_h, SIZE, SIZE], fill=(255, 255, 255, 255))
    img = Image.alpha_composite(img, band_img)
    draw = ImageDraw.Draw(img)

    # 重新绘制主体白底（顶部条以外区域）
    # 实际上更简单的做法：先画白色圆角，再画顶部蓝色条带
    img2 = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d2 = ImageDraw.Draw(img2)
    # 白色圆角主体
    d2.rounded_rectangle(rect, radius=radius, fill=(255, 255, 255, 255))
    # 顶部蓝色条（仅在主体范围内，圆角处理：用一个圆角矩形减去下部）
    band_top = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    bt = ImageDraw.Draw(band_top)
    band_rect = [margin, margin, SIZE - margin, margin + top_band_h + radius]
    bt.rounded_rectangle(band_rect, radius=radius, fill=(0, 122, 255, 255))
    # 用矩形遮住超出顶部条的部分
    bt.rectangle(
        [0, margin + top_band_h, SIZE, margin + top_band_h + radius * 2],
        fill=(0, 0, 0, 0),
    )
    # 重新画白色，遮住下半部分
    lower = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lower)
    ld.rectangle(
        [0, margin + top_band_h, SIZE, SIZE],
        fill=(255, 255, 255, 255),
    )
    # 先把 lower 合到 img2 上（覆盖下部为白）
    img2 = Image.alpha_composite(img2, lower)
    # 再合上顶部蓝条
    img2 = Image.alpha_composite(img2, band_top)

    # 用一个圆形蒙版裁出主体形状（保持圆角）
    mask = Image.new("L", (SIZE, SIZE), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle(rect, radius=radius, fill=255)
    final = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    final.paste(img2, (0, 0), mask)
    draw = ImageDraw.Draw(final)

    # 画 "=" 符号（两条蓝色横线）
    accent = (0, 122, 255, 255)
    eq_y_center = SIZE * 0.55
    bar_w = SIZE * 0.34
    bar_h = SIZE * 0.045
    gap = SIZE * 0.10
    cx = SIZE / 2
    # 上横
    bar1 = [
        cx - bar_w / 2,
        eq_y_center - gap / 2 - bar_h,
        cx + bar_w / 2,
        eq_y_center - gap / 2,
    ]
    draw.rounded_rectangle(bar1, radius=int(bar_h / 2), fill=accent)
    # 下横
    bar2 = [
        cx - bar_w / 2,
        eq_y_center + gap / 2,
        cx + bar_w / 2,
        eq_y_center + gap / 2 + bar_h,
    ]
    draw.rounded_rectangle(bar2, radius=int(bar_h / 2), fill=accent)

    # 保存 PNG 源
    png_path = os.path.join(OUT_DIR, "icon-source.png")
    final.save(png_path, "PNG")
    print(f"已生成: {png_path}")

    # 生成 ICO（多尺寸）
    ico_path = os.path.join(OUT_DIR, "icon.ico")
    # 缩放到各尺寸
    icons = []
    for sz in ICON_SIZES:
        resized = final.resize(sz, Image.LANCZOS)
        icons.append(resized)
    # 保存为 ICO
    icons[0].save(ico_path, format="ICO", sizes=ICON_SIZES)
    # 实际上 PIL 的 ICO 保存需要把所有尺寸都传给 save
    final.save(ico_path, format="ICO", sizes=ICON_SIZES)
    print(f"已生成: {ico_path}")

    # 同时保存 256 PNG（用于 GitHub 显示）
    big_png = os.path.join(OUT_DIR, "icon-256.png")
    final.resize((256, 256), Image.LANCZOS).save(big_png, "PNG")
    print(f"已生成: {big_png}")


if __name__ == "__main__":
    make_icon()
