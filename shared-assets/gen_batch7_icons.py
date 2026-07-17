# -*- coding: utf-8 -*-
"""第七批项目图标生成 - 6 个项目 (苹果白风格 / 纯 PIL 矢量手绘)
设计规范: 1024 白底 + frame 圆角外框 + #007AFF 线性描边 + 16px 统一线宽 + 圆角端点
"""
import os, math
from PIL import Image, ImageDraw, ImageFont

# ============ 设计规范常量 ============
SIZE = 1024
BG = (255, 255, 255)
BLUE = (0, 122, 255)            # #007AFF 主色
LINE_W = 16                    # 统一线宽
FRAME = [80, 80, 944, 944]     # 22% 圆角外框 [x0,y0,x1,y1]
FRAME_R = int((944 - 80) * 0.22)  # 圆角半径 ~190
OUT_DIR = r"D:\Ai\mimo\youqu\shared-assets\icons\projects"


# ============ 通用工具 ============
def line_round(d, p1, p2, w=LINE_W, fill=BLUE):
    """线段 + 圆角端点 (等价 stroke-linecap:round)"""
    d.line([p1, p2], fill=fill, width=w)
    r = w // 2
    d.ellipse([p1[0]-r, p1[1]-r, p1[0]+r, p1[1]+r], fill=fill)
    d.ellipse([p2[0]-r, p2[1]-r, p2[0]+r, p2[1]+r], fill=fill)


def poly_round(d, pts, w=LINE_W, fill=BLUE):
    """折线 + 圆角端点/节点"""
    for i in range(len(pts)-1):
        line_round(d, pts[i], pts[i+1], w, fill)


def bezier_pts(p0, p1, p2, n=24):
    """二次贝塞尔点序列 (用于平滑曲线, 替代字母)"""
    pts = []
    for i in range(n+1):
        t = i / n
        x = (1-t)**2*p0[0] + 2*(1-t)*t*p1[0] + t**2*p2[0]
        y = (1-t)**2*p0[1] + 2*(1-t)*t*p1[1] + t**2*p2[1]
        pts.append((x, y))
    return pts


def new_canvas():
    img = Image.new("RGB", (SIZE, SIZE), BG)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(FRAME, radius=FRAME_R, outline=BLUE, width=LINE_W)
    return img, d


def blue_ratio(img):
    px = img.load()
    w, h = img.size
    cnt = 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if b > 200 and 80 <= g <= 200 and r < 100:
                cnt += 1
    return cnt / (w * h) * 100


def save_all(img, name):
    """保存 1024 源 + 多尺寸 PNG + ICO"""
    d = os.path.join(OUT_DIR, name)
    os.makedirs(d, exist_ok=True)
    img.save(os.path.join(d, "icon-source.png"))
    for s in [16, 32, 48, 64, 128, 256, 512]:
        r = img.resize((s, s), Image.LANCZOS)
        r.save(os.path.join(d, f"icon-{s}.png"))
    ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    ico_imgs = [img.resize((s, s), Image.LANCZOS) for s, _ in ico_sizes]
    ico_imgs[0].save(os.path.join(d, "icon.ico"), format="ICO", sizes=ico_sizes)
    print(f"  [{name}] 蓝占比 {blue_ratio(img):.2f}%  -> saved")


# ============ 1. ocr-manager 文档 + 扫描线 ============
def draw_ocr(d):
    # 文档主体 (圆角矩形, 顶部右侧折角)
    dx0, dy0, dx1, dy1 = 340, 250, 684, 760
    fold = 70  # 折角大小
    # 文档轮廓: 左上 -> 右上(折角起点) -> 折角内点 -> 折角下点 -> 右下 -> 左下 -> 回左上
    pts = [
        (dx0, dy0),                       # 左上
        (dx1 - fold, dy0),                # 右上折角起点
        (dx1, dy0 + fold),                # 折角内点
        (dx1, dy1),                       # 右下
        (dx0, dy1),                       # 左下
        (dx0, dy0),                       # 回左上
    ]
    poly_round(d, pts)
    # 折角内斜线 (折角的两条边)
    line_round(d, (dx1 - fold, dy0), (dx1, dy0 + fold))
    # 文档内 4 行文本 (水平短线, 递减宽度)
    tx = dx0 + 50
    for i, w in enumerate([250, 200, 230, 160]):
        ty = dy0 + 110 + i * 70
        line_round(d, (tx, ty), (tx + w, ty))
    # 扫描线 (OCR 标志: 文档内的横向扫描线, 圆角端点, 保持封闭构图)
    sy = 540
    line_round(d, (dx0 + 30, sy), (dx1 - 30, sy))


# ============ 2. disk-manager 盘片 + 磁头 ============
def draw_disk(d):
    # 外盘片 (大圆) + 中心轴孔, 去掉中圈减少小尺寸粘连
    c = 512
    r_out = 290
    d.ellipse([c-r_out, c-r_out, c+r_out, c+r_out], outline=BLUE, width=LINE_W)
    # 中心轴孔
    r_hub = 64
    d.ellipse([c-r_hub, c-r_hub, c+r_hub, c+r_hub], outline=BLUE, width=LINE_W)
    # 读写磁头臂 (从右上伸入, 内收留呼吸感)
    arm_outer = (736, 256)
    arm_inner = (588, 404)   # 接近盘片上方, 远离外框
    line_round(d, arm_outer, arm_inner)
    # 磁头小方块 (臂末端)
    hx0, hy0, hx1, hy1 = arm_inner[0]-24, arm_inner[1]-10, arm_inner[0]+24, arm_inner[1]+28
    d.rounded_rectangle([hx0, hy0, hx1, hy1], radius=10, outline=BLUE, width=LINE_W)
    # 臂枢轴 (顶端小圆)
    pr = 24
    d.ellipse([arm_outer[0]-pr, arm_outer[1]-pr, arm_outer[0]+pr, arm_outer[1]+pr], outline=BLUE, width=LINE_W)


# ============ 3. keyboard-tester 按键网格 + 空格键 ============
def draw_keyboard(d):
    # 2 行 x 3 列 键 + 实心空格键 (空格键=键盘标志+焦点, 收窄控制重量)
    cols, rows = 3, 2
    kw, kh = 140, 140
    gap = 34
    total_w = cols*kw + (cols-1)*gap
    total_h = rows*kh + (rows-1)*gap
    x0 = (SIZE - total_w) // 2
    y0 = 308
    kr = 26
    for r in range(rows):
        for c in range(cols):
            kx = x0 + c*(kw+gap)
            ky = y0 + r*(kh+gap)
            d.rounded_rectangle([kx, ky, kx+kw, ky+kh], radius=kr, outline=BLUE, width=LINE_W)
    # 空格键 (描边横条, 键盘标志; 全图标回归纯线性统一风格)
    sb_y = y0 + total_h + 28
    sb_w = 280
    sb_h = 56
    d.rounded_rectangle([SIZE//2 - sb_w//2, sb_y, SIZE//2 + sb_w//2, sb_y + sb_h],
                        radius=22, outline=BLUE, width=LINE_W)


# ============ 4. text-manager 文本气泡 (圆角气泡 + 尾巴 + 文本行, 纯几何直观) ============
def draw_text(d):
    # 气泡主体 (圆角矩形)
    d.rounded_rectangle([260, 300, 764, 660], radius=44, outline=BLUE, width=LINE_W)
    # 左下尾巴 (贝塞尔曲线, 柔化与圆角语言统一, 避免尖锐角)
    tail_base_l = (372, 660)
    tail_tip = (352, 744)
    tail_base_r = (452, 660)
    poly_round(d, bezier_pts(tail_base_l, (360, 710), tail_tip))
    poly_round(d, bezier_pts(tail_tip, (430, 725), tail_base_r))
    # 3 行文本
    tx = 332
    widths = [372, 332, 272]
    y0 = 384
    for i, w in enumerate(widths):
        ty = y0 + i * 80
        line_round(d, (tx, ty), (tx + w, ty))


# ============ 5. eye-rest-manager 开眼 (杏仁轮廓 + 瞳孔, 纯几何) ============
def draw_eye_rest(d):
    # 杏仁眼: 左右两端尖角, 上下两条贝塞尔弧
    eye_cx, eye_cy = 512, 512
    half_w = 280          # 左右半宽
    peak = 130            # 上下弧峰高
    left = (eye_cx - half_w, eye_cy)
    right = (eye_cx + half_w, eye_cy)
    # 上弧 (左 -> 上峰 -> 右)
    upper = bezier_pts(left, (eye_cx, eye_cy - peak), right)
    poly_round(d, upper)
    # 下弧 (左 -> 下峰 -> 右)
    lower = bezier_pts(left, (eye_cx, eye_cy + peak), right)
    poly_round(d, lower)
    # 虹膜 (描边圆) + 瞳孔 (小描边圆, 全纯线性无填充, 避免 low-res 糊点)
    iris_r = 82
    d.ellipse([eye_cx-iris_r, eye_cy-iris_r, eye_cx+iris_r, eye_cy+iris_r], outline=BLUE, width=LINE_W)
    pupil_r = 38
    d.ellipse([eye_cx-pupil_r, eye_cy-pupil_r, eye_cx+pupil_r, eye_cy+pupil_r], outline=BLUE, width=LINE_W)


# ============ 6. port-manager USB 端口插槽 (外壳 + 内插槽 + 触片) ============
def draw_port(d):
    # 外壳 (设备边缘的端口面)
    d.rounded_rectangle([300, 360, 724, 664], radius=36, outline=BLUE, width=LINE_W)
    # 内部端口开口 (插槽)
    d.rounded_rectangle([366, 420, 658, 604], radius=22, outline=BLUE, width=LINE_W)
    # 接口触片 (中间填充横条, 与 eye 瞳孔/keyboard 焦点键统一填充语言)
    d.rounded_rectangle([412, 498, 612, 526], radius=10, fill=BLUE)


# ============ 主流程 ============
def main():
    print("第七批图标生成开始 (6 个项目, 苹果白风格)")
    items = [
        ("ocr-manager", draw_ocr),
        ("disk-manager", draw_disk),
        ("keyboard-tester", draw_keyboard),
        ("text-manager", draw_text),
        ("eye-rest-manager", draw_eye_rest),
        ("port-manager", draw_port),
    ]
    for name, fn in items:
        img, d = new_canvas()
        fn(d)
        save_all(img, name)
    print("全部完成")


if __name__ == "__main__":
    main()
