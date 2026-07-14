# -*- coding: utf-8 -*-
"""拾色管家·便携版 - 核心逻辑单元测试

覆盖：
- 颜色转换（HEX/RGB/HSL 互逆、边界值、非法输入）
- WCAG 对比度（黑白比值、相对亮度、等级评估）
- 最佳前景色
- 快捷键校验
- 存储模块（加载/保存往返、历史去重与上限、调色板增删改、清空）

运行：
    python -m pytest tests/test_core.py -v
或：
    python tests/test_core.py
"""

from __future__ import annotations

import os
import sys
import json
import tempfile
import shutil

# 让 import 能找到 src 目录
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src'))

import color_core as cc


# ================================================================
#  颜色转换
# ================================================================

class TestClamp:
    def test_within_range(self):
        assert cc.clamp(5, 0, 10) == 5

    def test_above_max(self):
        assert cc.clamp(15, 0, 10) == 10

    def test_below_min(self):
        assert cc.clamp(-3, 0, 10) == 0

    def test_boundaries(self):
        assert cc.clamp(0, 0, 10) == 0
        assert cc.clamp(10, 0, 10) == 10


class TestHexToRgb:
    def test_standard_6digit(self):
        assert cc.hex_to_rgb('#007AFF') == {'r': 0, 'g': 122, 'b': 255}

    def test_without_hash(self):
        assert cc.hex_to_rgb('007AFF') == {'r': 0, 'g': 122, 'b': 255}

    def test_lowercase(self):
        assert cc.hex_to_rgb('#007aff') == {'r': 0, 'g': 122, 'b': 255}

    def test_3digit_shorthand(self):
        # #abc → #aabbcc
        assert cc.hex_to_rgb('#abc') == {'r': 170, 'g': 187, 'b': 204}

    def test_invalid_length(self):
        assert cc.hex_to_rgb('#1234') is None
        assert cc.hex_to_rgb('#1234567') is None

    def test_invalid_chars(self):
        assert cc.hex_to_rgb('#gggggg') is None
        assert cc.hex_to_rgb('#00FF00 extra') is None

    def test_non_string(self):
        assert cc.hex_to_rgb(None) is None
        assert cc.hex_to_rgb(123) is None

    def test_with_whitespace(self):
        assert cc.hex_to_rgb('  #007AFF  ') == {'r': 0, 'g': 122, 'b': 255}


class TestRgbToHex:
    def test_black(self):
        assert cc.rgb_to_hex(0, 0, 0) == '#000000'

    def test_white(self):
        assert cc.rgb_to_hex(255, 255, 255) == '#ffffff'

    def test_apple_blue(self):
        assert cc.rgb_to_hex(0, 122, 255) == '#007aff'

    def test_clamps_overflow(self):
        # 超出 255 应该被限制
        assert cc.rgb_to_hex(300, -10, 128) == '#ff0080'

    def test_rounds_floats(self):
        assert cc.rgb_to_hex(0.4, 122.4, 254.6) == '#007aff'


class TestRgbHslRoundTrip:
    def test_pure_red(self):
        hsl = cc.rgb_to_hsl(255, 0, 0)
        assert hsl == {'h': 0, 's': 100, 'l': 50}
        rgb = cc.hsl_to_rgb(hsl['h'], hsl['s'], hsl['l'])
        assert rgb == {'r': 255, 'g': 0, 'b': 0}

    def test_pure_green(self):
        hsl = cc.rgb_to_hsl(0, 255, 0)
        assert hsl == {'h': 120, 's': 100, 'l': 50}
        rgb = cc.hsl_to_rgb(hsl['h'], hsl['s'], hsl['l'])
        assert rgb == {'r': 0, 'g': 255, 'b': 0}

    def test_pure_blue(self):
        hsl = cc.rgb_to_hsl(0, 0, 255)
        assert hsl == {'h': 240, 's': 100, 'l': 50}
        rgb = cc.hsl_to_rgb(hsl['h'], hsl['s'], hsl['l'])
        assert rgb == {'r': 0, 'g': 0, 'b': 255}

    def test_white(self):
        hsl = cc.rgb_to_hsl(255, 255, 255)
        assert hsl['s'] == 0
        assert hsl['l'] == 100

    def test_black(self):
        hsl = cc.rgb_to_hsl(0, 0, 0)
        assert hsl['s'] == 0
        assert hsl['l'] == 0

    def test_gray(self):
        # 灰色：s=0, l=50
        hsl = cc.rgb_to_hsl(128, 128, 128)
        assert hsl['s'] == 0
        assert hsl['l'] == 50

    def test_apple_blue_roundtrip(self):
        rgb = {'r': 0, 'g': 122, 'b': 255}
        hsl = cc.rgb_to_hsl(rgb['r'], rgb['g'], rgb['b'])
        rgb2 = cc.hsl_to_rgb(hsl['h'], hsl['s'], hsl['l'])
        # HSL 往返转换存在 ±1 舍入误差（hsl 整数化导致）
        assert abs(rgb2['r'] - rgb['r']) <= 1
        assert abs(rgb2['g'] - rgb['g']) <= 1
        assert abs(rgb2['b'] - rgb['b']) <= 1

    def test_hsl_to_rgb_hue_wrapping(self):
        # h=360 应等同于 h=0
        rgb1 = cc.hsl_to_rgb(0, 100, 50)
        rgb2 = cc.hsl_to_rgb(360, 100, 50)
        assert rgb1 == rgb2

    def test_hsl_to_rgb_negative_hue(self):
        rgb1 = cc.hsl_to_rgb(-120, 100, 50)
        rgb2 = cc.hsl_to_rgb(240, 100, 50)
        assert rgb1 == rgb2


class TestColorDistance:
    def test_same_color(self):
        a = {'r': 100, 'g': 100, 'b': 100}
        assert cc.color_distance(a, a) == 0

    def test_black_white(self):
        black = {'r': 0, 'g': 0, 'b': 0}
        white = {'r': 255, 'g': 255, 'b': 255}
        d = cc.color_distance(black, white)
        assert abs(d - (255 * 255 * 3) ** 0.5) < 0.001


class TestBestForeground:
    def test_white_background(self):
        assert cc.best_foreground(255, 255, 255) == '#1d1d1f'

    def test_black_background(self):
        assert cc.best_foreground(0, 0, 0) == '#ffffff'

    def test_apple_blue_background(self):
        # #007AFF luminance ≈ 0.2126*0 + 0.7152*0.478 + 0.0722*1 = ~0.415
        # < 0.55, so foreground should be white
        assert cc.best_foreground(0, 122, 255) == '#ffffff'

    def test_yellow_background(self):
        # 亮黄色 luminance 高
        assert cc.best_foreground(255, 255, 0) == '#1d1d1f'


class TestFormatColor:
    def test_all_formats_present(self):
        fmt = cc.format_color({'r': 0, 'g': 122, 'b': 255})
        assert fmt['hex'] == '#007aff'
        assert fmt['hexUpper'] == '#007AFF'
        assert fmt['rgb'] == 'rgb(0, 122, 255)'
        assert fmt['hsl'].startswith('hsl(')
        assert fmt['rgbObj'] == {'r': 0, 'g': 122, 'b': 255}
        assert 'h' in fmt['hslObj']
        assert 's' in fmt['hslObj']
        assert 'l' in fmt['hslObj']


# ================================================================
#  WCAG 2.1 对比度
# ================================================================

class TestRelativeLuminance:
    def test_black(self):
        assert cc.relative_luminance(0, 0, 0) == 0

    def test_white(self):
        assert abs(cc.relative_luminance(255, 255, 255) - 1.0) < 0.001


class TestContrastRatio:
    def test_same_color(self):
        c = {'r': 100, 'g': 100, 'b': 100}
        assert abs(cc.contrast_ratio(c, c) - 1.0) < 0.001

    def test_black_vs_white(self):
        black = {'r': 0, 'g': 0, 'b': 0}
        white = {'r': 255, 'g': 255, 'b': 255}
        ratio = cc.contrast_ratio(black, white)
        assert abs(ratio - 21.0) < 0.01

    def test_order_independent(self):
        a = {'r': 100, 'g': 50, 'b': 200}
        b = {'r': 200, 'g': 100, 'b': 50}
        assert abs(cc.contrast_ratio(a, b) - cc.contrast_ratio(b, a)) < 0.001


class TestWcagGrade:
    def test_black_white_21(self):
        g = cc.wcag_grade(21)
        assert g['aaNormal'] is True
        assert g['aaaNormal'] is True
        assert g['aaLarge'] is True
        assert g['aaaLarge'] is True

    def test_ratio_4_5(self):
        g = cc.wcag_grade(4.5)
        assert g['aaNormal'] is True
        assert g['aaaNormal'] is False
        assert g['aaaLarge'] is True

    def test_ratio_3(self):
        g = cc.wcag_grade(3)
        assert g['aaNormal'] is False
        assert g['aaLarge'] is True

    def test_ratio_1(self):
        g = cc.wcag_grade(1)
        assert g['aaNormal'] is False
        assert g['aaLarge'] is False

    def test_negative_input(self):
        g = cc.wcag_grade(-5)
        assert g['ratio'] == 0
        assert g['aaNormal'] is False

    def test_non_numeric_input(self):
        g = cc.wcag_grade(None)
        assert g['ratio'] == 0

    def test_ratio_rounding(self):
        # 4.567 → 4.57
        g = cc.wcag_grade(4.567)
        assert g['ratio'] == 4.57


# ================================================================
#  快捷键校验
# ================================================================

class TestValidateShortcut:
    def test_valid_standard(self):
        assert cc.validate_shortcut('Ctrl+Shift+C') is True

    def test_valid_minimal(self):
        assert cc.validate_shortcut('Ctrl+A') is True

    def test_valid_function_key(self):
        assert cc.validate_shortcut('Ctrl+F1') is True

    def test_missing_modifier(self):
        assert cc.validate_shortcut('A') is False

    def test_missing_key(self):
        assert cc.validate_shortcut('Ctrl') is False

    def test_invalid_modifier(self):
        assert cc.validate_shortcut('Foo+C') is False

    def test_invalid_key(self):
        assert cc.validate_shortcut('Ctrl+!') is False

    def test_non_string(self):
        assert cc.validate_shortcut(None) is False
        assert cc.validate_shortcut(123) is False

    def test_empty_string(self):
        assert cc.validate_shortcut('') is False
        assert cc.validate_shortcut('   ') is False

    def test_with_whitespace(self):
        assert cc.validate_shortcut('  Ctrl + Shift + C  ') is True


# ================================================================
#  存储模块
# ================================================================

class TestStoreLoadSave:
    def test_default_data_structure(self):
        d = cc.default_data()
        assert 'history' in d
        assert 'palettes' in d
        assert 'settings' in d
        assert d['history'] == []
        assert len(d['palettes']) >= 1
        assert d['palettes'][0]['id'] == 'default'
        assert '#007AFF' in d['palettes'][0]['colors']

    def test_load_nonexistent_returns_default(self):
        d = cc.load_store('/nonexistent/path/file.json')
        assert d == cc.default_data()

    def test_load_invalid_json_returns_default(self, tmp_path):
        bad = tmp_path / 'bad.json'
        bad.write_text('not valid json{', encoding='utf-8')
        d = cc.load_store(str(bad))
        assert d == cc.default_data()

    def test_round_trip(self, tmp_path):
        f = str(tmp_path / 'data.json')
        d = cc.default_data()
        d['history'].append({'hex': '#007aff', 'r': 0, 'g': 122, 'b': 255, 'ts': 1000})
        assert cc.save_store(f, d) is True
        loaded = cc.load_store(f)
        assert loaded['history'] == d['history']
        assert loaded['palettes'] == d['palettes']
        assert loaded['settings'] == d['settings']

    def test_save_creates_directory(self, tmp_path):
        f = str(tmp_path / 'subdir' / 'data.json')
        d = cc.default_data()
        assert cc.save_store(f, d) is True
        assert os.path.exists(f)


class TestPushHistory:
    def test_add_new_color(self):
        d = cc.default_data()
        cc.push_history(d, '#007aff', {'r': 0, 'g': 122, 'b': 255})
        assert len(d['history']) == 1
        assert d['history'][0]['hex'] == '#007aff'

    def test_dedup_same_color_lowercase(self):
        d = cc.default_data()
        cc.push_history(d, '#007aff', {'r': 0, 'g': 122, 'b': 255})
        cc.push_history(d, '#007AFF', {'r': 0, 'g': 122, 'b': 255})
        assert len(d['history']) == 1
        # 最新置顶，hex 应保留新写入的（大写）
        assert d['history'][0]['hex'] == '#007AFF'

    def test_max_history_limit(self):
        d = cc.default_data()
        for i in range(cc.MAX_HISTORY + 20):
            cc.push_history(d, f'#{i:06x}', {'r': i & 0xff, 'g': (i >> 8) & 0xff, 'b': 0})
        assert len(d['history']) == cc.MAX_HISTORY

    def test_most_recent_first(self):
        d = cc.default_data()
        cc.push_history(d, '#ff0000', {'r': 255, 'g': 0, 'b': 0})
        cc.push_history(d, '#00ff00', {'r': 0, 'g': 255, 'b': 0})
        assert d['history'][0]['hex'] == '#00ff00'
        assert d['history'][1]['hex'] == '#ff0000'


class TestPaletteOperations:
    def test_create_palette(self):
        d = cc.default_data()
        before = len(d['palettes'])
        p = cc.create_palette(d, '我的色卡')
        assert p['name'] == '我的色卡'
        assert p['id'].startswith('p_')
        assert len(d['palettes']) == before + 1

    def test_create_palette_default_name(self):
        d = cc.default_data()
        p = cc.create_palette(d, '')
        assert p['name'] == '未命名调色板'

    def test_delete_palette_keeps_at_least_one(self):
        d = cc.default_data()
        assert cc.delete_palette(d, 'default') is False
        assert len(d['palettes']) == 1

    def test_delete_palette_success(self):
        d = cc.default_data()
        cc.create_palette(d, 'extra')
        assert len(d['palettes']) == 2
        new_id = d['palettes'][-1]['id']
        assert cc.delete_palette(d, new_id) is True
        assert len(d['palettes']) == 1

    def test_add_color_to_palette(self):
        d = cc.default_data()
        assert cc.add_color_to_palette(d, 'default', '#abcdef') is True
        assert '#abcdef' in d['palettes'][0]['colors']

    def test_add_color_dedup(self):
        d = cc.default_data()
        # #007AFF 已在默认调色板里
        before = len(d['palettes'][0]['colors'])
        assert cc.add_color_to_palette(d, 'default', '#007aff') is False
        assert len(d['palettes'][0]['colors']) == before

    def test_add_color_to_nonexistent_palette(self):
        d = cc.default_data()
        assert cc.add_color_to_palette(d, 'no_such_id', '#123456') is False

    def test_remove_color_from_palette(self):
        d = cc.default_data()
        before = len(d['palettes'][0]['colors'])
        assert cc.remove_color_from_palette(d, 'default', '#007aff') is True
        assert len(d['palettes'][0]['colors']) == before - 1

    def test_remove_nonexistent_color(self):
        d = cc.default_data()
        before = len(d['palettes'][0]['colors'])
        assert cc.remove_color_from_palette(d, 'default', '#abcdef') is False
        assert len(d['palettes'][0]['colors']) == before

    def test_rename_palette(self):
        d = cc.default_data()
        assert cc.rename_palette(d, 'default', '我的色卡') is True
        assert d['palettes'][0]['name'] == '我的色卡'

    def test_rename_palette_empty_name(self):
        d = cc.default_data()
        assert cc.rename_palette(d, 'default', '') is False
        assert cc.rename_palette(d, 'default', '   ') is False

    def test_rename_nonexistent_palette(self):
        d = cc.default_data()
        assert cc.rename_palette(d, 'no_such_id', 'new name') is False


class TestClearHistory:
    def test_clear_empty_history(self):
        d = cc.default_data()
        assert cc.clear_history(d) == 0

    def test_clear_with_entries(self):
        d = cc.default_data()
        cc.push_history(d, '#ff0000', {'r': 255, 'g': 0, 'b': 0})
        cc.push_history(d, '#00ff00', {'r': 0, 'g': 255, 'b': 0})
        removed = cc.clear_history(d)
        assert removed == 2
        assert d['history'] == []


# ================================================================
#  pytest 兼容
# ================================================================

# tmp_path fixture 由 pytest 提供。如果用 python tests/test_core.py 直接跑，
# 会因为没有 tmp_path 而失败。提供一个简单的回退：
if __name__ == '__main__':
    import pytest
    sys.exit(pytest.main([__file__, '-v']))
