# -*- coding: utf-8 -*-
"""计算器便携版 · 引擎单元测试
覆盖：词法、四则运算、优先级、括号、函数、常量、变量、阶乘、进制前缀、位运算、格式化、错误处理
"""
import math
import unittest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
from calc_engine import (  # noqa: E402
    tokenize, evaluate, try_parse_assignment, factorial, format_result,
    to_rpn, evaluate_rpn, FUNCTIONS, CONSTANTS,
)


class TestTokenize(unittest.TestCase):
    def test_number(self):
        t = tokenize('123')
        self.assertEqual(len(t), 1)
        self.assertEqual(t[0].value, '123')

    def test_decimal(self):
        self.assertEqual(tokenize('3.14')[0].value, '3.14')

    def test_scientific(self):
        self.assertEqual(tokenize('1e3')[0].value, '1e3')
        self.assertEqual(tokenize('1.5e-3')[0].value, '1.5e-3')

    def test_hex(self):
        self.assertEqual(tokenize('0xFF')[0].value, '255')

    def test_binary(self):
        self.assertEqual(tokenize('0b1010')[0].value, '10')

    def test_octal(self):
        self.assertEqual(tokenize('0o17')[0].value, '15')

    def test_ident(self):
        t = tokenize('sin(1)')
        self.assertEqual(t[0].value, 'sin')


class TestBasic(unittest.TestCase):
    def test_add(self):
        self.assertAlmostEqual(evaluate('2 + 3'), 5)

    def test_sub(self):
        self.assertAlmostEqual(evaluate('10 - 4'), 6)

    def test_mul(self):
        self.assertAlmostEqual(evaluate('6 * 7'), 42)

    def test_div(self):
        self.assertAlmostEqual(evaluate('15 / 4'), 3.75)

    def test_mod(self):
        self.assertAlmostEqual(evaluate('10 % 3'), 1)

    def test_precedence(self):
        self.assertAlmostEqual(evaluate('2 + 3 * 4'), 14)

    def test_parens(self):
        self.assertAlmostEqual(evaluate('(2 + 3) * 4'), 20)

    def test_nested_parens(self):
        self.assertAlmostEqual(evaluate('((1 + 2) * (3 + 4))'), 21)

    def test_power(self):
        self.assertAlmostEqual(evaluate('2 ^ 10'), 1024)

    def test_unary_neg(self):
        self.assertAlmostEqual(evaluate('-5'), -5)

    def test_unary_neg_in_expr(self):
        self.assertAlmostEqual(evaluate('3 * -2'), -6)

    def test_power_then_neg(self):
        # -2^2 = -4 (一元负优先级低于 ^)
        self.assertAlmostEqual(evaluate('-2 ^ 2'), -4)


class TestFunctions(unittest.TestCase):
    def test_sin(self):
        self.assertAlmostEqual(evaluate('sin(0)'), 0)

    def test_sin_pi_half(self):
        self.assertAlmostEqual(evaluate('sin(pi/2)'), 1)

    def test_cos_sq_plus_sin_sq(self):
        self.assertAlmostEqual(evaluate('sin(pi/4)^2 + cos(pi/4)^2'), 1)

    def test_log(self):
        self.assertAlmostEqual(evaluate('log(1000)'), 3)

    def test_ln(self):
        self.assertAlmostEqual(evaluate('ln(e)'), 1)

    def test_sqrt(self):
        self.assertAlmostEqual(evaluate('sqrt(16)'), 4)

    def test_abs(self):
        self.assertAlmostEqual(evaluate('abs(-7)'), 7)

    def test_two_arg_pow(self):
        self.assertAlmostEqual(evaluate('pow(2, 10)'), 1024)

    def test_max(self):
        self.assertAlmostEqual(evaluate('max(3, 7)'), 7)

    def test_gcd(self):
        self.assertAlmostEqual(evaluate('gcd(12, 18)'), 6)

    def test_lcm(self):
        self.assertAlmostEqual(evaluate('lcm(4, 6)'), 12)


class TestConstants(unittest.TestCase):
    def test_pi(self):
        self.assertAlmostEqual(evaluate('pi'), math.pi)

    def test_e(self):
        self.assertAlmostEqual(evaluate('e'), math.e)

    def test_tau(self):
        self.assertAlmostEqual(evaluate('tau'), math.tau)

    def test_phi(self):
        self.assertAlmostEqual(evaluate('phi'), (1 + math.sqrt(5)) / 2)


class TestFactorial(unittest.TestCase):
    def test_five(self):
        self.assertEqual(factorial(5), 120)

    def test_zero(self):
        self.assertEqual(factorial(0), 1)

    def test_one(self):
        self.assertEqual(factorial(1), 1)

    def test_in_expr(self):
        self.assertAlmostEqual(evaluate('5!'), 120)

    def test_gamma_half(self):
        # 0.5! = sqrt(pi)/2
        self.assertAlmostEqual(factorial(0.5), math.sqrt(math.pi) / 2, places=6)

    def test_negative_error(self):
        with self.assertRaises(ValueError):
            factorial(-1)


class TestVariables(unittest.TestCase):
    def test_assign_and_use(self):
        v = {}
        r = try_parse_assignment('x = 5', v)
        self.assertEqual(r['name'], 'x')
        self.assertEqual(r['value'], 5)
        v[r['name']] = r['value']
        self.assertAlmostEqual(evaluate('x * x + 2 * x + 1', v), 36)

    def test_chained_assign(self):
        v = {}
        r1 = try_parse_assignment('x = 5', v)
        v[r1['name']] = r1['value']
        r2 = try_parse_assignment('y = x + 10', v)
        self.assertEqual(r2['value'], 15)
        v[r2['name']] = r2['value']
        self.assertAlmostEqual(evaluate('y * 2', v), 30)

    def test_cannot_assign_function(self):
        with self.assertRaises(ValueError):
            try_parse_assignment('sin = 5')

    def test_cannot_assign_constant(self):
        with self.assertRaises(ValueError):
            try_parse_assignment('pi = 5')

    def test_unknown_var(self):
        with self.assertRaises(ValueError):
            evaluate('foo + 1')


class TestBases(unittest.TestCase):
    def test_hex_add(self):
        self.assertAlmostEqual(evaluate('0xFF + 0x01'), 256)

    def test_binary_and(self):
        self.assertAlmostEqual(evaluate('0b1010 and 0b0011'), 2)

    def test_hex_or(self):
        self.assertAlmostEqual(evaluate('0xF0 or 0x0F'), 255)

    def test_shl(self):
        self.assertAlmostEqual(evaluate('1 shl 4'), 16)

    def test_not(self):
        self.assertAlmostEqual(evaluate('not 0'), -1)


class TestFormat(unittest.TestCase):
    def test_int(self):
        self.assertEqual(format_result(1000), '1,000')

    def test_float(self):
        self.assertEqual(format_result(3.14), '3.14')

    def test_negative_zero(self):
        self.assertEqual(format_result(-0.0), '0')

    def test_nan(self):
        self.assertEqual(format_result(float('nan')), 'NaN')

    def test_inf(self):
        self.assertEqual(format_result(float('inf')), '∞')

    def test_trailing_zeros(self):
        self.assertEqual(format_result(2.5), '2.5')

    def test_large_int(self):
        self.assertEqual(format_result(1000000), '1,000,000')


class TestErrors(unittest.TestCase):
    def test_div_zero(self):
        with self.assertRaises(ValueError):
            evaluate('1 / 0')

    def test_mod_zero(self):
        with self.assertRaises(ValueError):
            evaluate('1 % 0')

    def test_empty(self):
        with self.assertRaises(ValueError):
            evaluate('')

    def test_unmatched_paren(self):
        with self.assertRaises(ValueError):
            evaluate('(1 + 2')

    def test_unknown_char(self):
        with self.assertRaises(ValueError):
            evaluate('1 @ 2')

    def test_unknown_func(self):
        with self.assertRaises(ValueError):
            evaluate('foo(1)')

    def test_incomplete(self):
        with self.assertRaises(ValueError):
            evaluate('1 +')


if __name__ == '__main__':
    unittest.main(verbosity=2)
