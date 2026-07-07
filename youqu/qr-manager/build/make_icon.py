# build/make_icon.py — 将 icon-source.png 转换为多尺寸 icon.ico
# 用法：python build/make_icon.py
from PIL import Image
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'icon-source.png')
DST_ICO = os.path.join(HERE, 'icon.ico')
DST_PNG = os.path.join(HERE, 'icon-256.png')

def main():
    if not os.path.exists(SRC):
        raise SystemExit('找不到 icon-source.png，请先生成')
    img = Image.open(SRC).convert('RGBA')
    # 居中裁剪为正方形
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img = img.crop((left, top, left + side, top + side))
    # 缩放到 256
    img = img.resize((256, 256), Image.LANCZOS)
    img.save(DST_PNG, 'PNG')
    # 保存为多尺寸 ico
    sizes = [(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)]
    img.save(DST_ICO, format='ICO', sizes=sizes)
    print('OK ->', DST_ICO)
    print('OK ->', DST_PNG)

if __name__ == '__main__':
    main()
