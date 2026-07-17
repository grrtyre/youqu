# -*- coding: utf-8 -*-
"""
轻量语法高亮引擎 - 基于正则的 token 匹配
支持：JavaScript/TypeScript, Python, CSS, HTML, JSON, Bash, SQL, Go, Rust, Java, etc.
将代码转为 HTML 字符串，供 QTextBrowser 显示。
"""
import re
import html as _html


# 语言关键字表
KEYWORDS = {
    "javascript": ["const", "let", "var", "function", "return", "if", "else", "for",
                   "while", "do", "switch", "case", "break", "continue", "new", "class",
                   "extends", "super", "this", "typeof", "instanceof", "in", "of", "try",
                   "catch", "finally", "throw", "async", "await", "yield", "import",
                   "export", "from", "default", "delete", "void", "null", "undefined",
                   "true", "false", "static", "get", "set"],
    "typescript": ["const", "let", "var", "function", "return", "if", "else", "for",
                   "while", "do", "switch", "case", "break", "continue", "new", "class",
                   "extends", "super", "this", "typeof", "instanceof", "in", "of", "try",
                   "catch", "finally", "throw", "async", "await", "yield", "import",
                   "export", "from", "default", "delete", "void", "null", "undefined",
                   "true", "false", "static", "get", "set", "interface", "type", "enum",
                   "namespace", "readonly", "public", "private", "protected", "abstract",
                   "implements", "as", "is", "number", "string", "boolean", "any", "unknown", "never"],
    "python": ["def", "class", "return", "if", "elif", "else", "for", "while", "break",
               "continue", "pass", "import", "from", "as", "try", "except", "finally",
               "raise", "with", "lambda", "yield", "global", "nonlocal", "assert",
               "del", "in", "not", "and", "or", "is", "None", "True", "False",
               "self", "cls", "async", "await", "print", "len", "range", "str", "int",
               "float", "list", "dict", "set", "tuple", "bool"],
    "css": ["important", "root", "media", "keyframes", "from", "to", "and", "not",
            "only", "all", "screen", "print"],
    "bash": ["echo", "cd", "ls", "mkdir", "rm", "cp", "mv", "cat", "grep", "find",
             "sudo", "apt", "yum", "brew", "git", "docker", "npm", "node", "python",
             "pip", "export", "source", "alias", "if", "then", "else", "fi", "for",
             "do", "done", "while", "case", "esac", "function", "return", "exit",
             "chmod", "chown", "tar", "wget", "curl", "ps", "kill", "systemctl",
             "service", "which", "whereis", "head", "tail", "sort", "uniq", "wc",
             "awk", "sed", "xargs", "tee"],
    "sql": ["SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "CREATE", "DROP",
            "ALTER", "TABLE", "INDEX", "VIEW", "INTO", "VALUES", "SET", "JOIN", "LEFT",
            "RIGHT", "INNER", "OUTER", "ON", "AS", "AND", "OR", "NOT", "NULL", "IS",
            "IN", "LIKE", "BETWEEN", "ORDER", "BY", "GROUP", "HAVING", "LIMIT",
            "OFFSET", "DISTINCT", "COUNT", "SUM", "AVG", "MIN", "MAX", "UNION",
            "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "DEFAULT", "UNIQUE", "CHECK",
            "CONSTRAINT", "CASCADE", "BEGIN", "COMMIT", "ROLLBACK", "TRANSACTION",
            "CASE", "WHEN", "THEN", "ELSE", "END", "IF", "EXISTS", "CAST", "CONVERT",
            "VARCHAR", "INT", "INTEGER", "BIGINT", "SMALLINT", "DECIMAL", "FLOAT",
            "DATE", "DATETIME", "TIMESTAMP", "BOOLEAN", "TEXT", "BLOB"],
    "go": ["package", "import", "func", "var", "const", "type", "struct", "interface",
           "return", "if", "else", "for", "range", "switch", "case", "default",
           "break", "continue", "fallthrough", "defer", "go", "chan", "select",
           "map", "make", "new", "len", "cap", "append", "copy", "delete", "panic",
           "recover", "true", "false", "nil", "iota"],
    "rust": ["fn", "let", "mut", "const", "static", "struct", "enum", "trait", "impl",
             "pub", "use", "mod", "crate", "self", "super", "as", "in", "ref", "move",
             "return", "if", "else", "for", "while", "loop", "match", "break",
             "continue", "true", "false", "Some", "None", "Ok", "Err", "Result",
             "Option", "Vec", "String", "str", "i32", "i64", "u32", "u64", "f32",
             "f64", "bool", "char", "async", "await", "dyn", "where", "unsafe"],
    "java": ["public", "private", "protected", "class", "interface", "extends",
             "implements", "static", "final", "abstract", "void", "int", "long",
             "double", "float", "boolean", "char", "byte", "short", "String",
             "return", "if", "else", "for", "while", "do", "switch", "case", "break",
             "continue", "new", "this", "super", "try", "catch", "finally", "throw",
             "throws", "import", "package", "null", "true", "false", "instanceof",
             "synchronized", "volatile", "transient", "native", "enum", "assert"],
    "json": ["true", "false", "null"],
}

# 通用 token 正则
TOKEN_PATTERNS = [
    # 注释（块注释）
    ("comment", r"/\*[\s\S]*?\*/"),
    # 注释（行注释 // 或 #）
    ("comment", r"//[^\n]*|#[^\n]*"),
    # 字符串（双引号、单引号、模板字符串、三引号）
    ("string", r'"""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\'|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|`(?:\\.|[^`\\])*`'),
    # 数字
    ("number", r"\b\d+\.?\d*([eE][+-]?\d+)?[fFdLuU]*\b|0[xX][0-9a-fA-F]+"),
    # 函数名（标识符后跟括号）
    ("function", r"\b([a-zA-Z_]\w*)\s*(?=\()"),
    # HTML 标签
    ("tag", r"</?[a-zA-Z][\w-]*\b"),
    # HTML 属性
    ("attr", r"\b[a-zA-Z-]+(?==)"),
]

# 高亮颜色（苹果白风格的柔和色调）
COLORS = {
    "comment": "#8e8e93",   # 灰色注释
    "string": "#34c759",    # 绿色字符串
    "number": "#ff9500",    # 橙色数字
    "keyword": "#007aff",   # 蓝色关键字
    "function": "#5856d6",  # 紫色函数名
    "tag": "#ff3b30",       # 红色标签
    "attr": "#af52de",      # 紫色属性
    "text": "#1d1d1f",      # 深色文本
}


def highlight(code, language="javascript"):
    """
    将代码高亮为 HTML 字符串。
    返回带 <span> 标签的 HTML，转义过特殊字符。
    注意：在原始代码上做正则匹配，再对每段分别转义，避免引号被转义后无法匹配。
    """
    if not code:
        return ""

    lang_lower = (language or "").lower()
    keywords = set(KEYWORDS.get(lang_lower, KEYWORDS.get("javascript", [])))

    # 在原始代码上匹配 token（不先转义，否则引号变 &quot; 导致字符串正则失效）
    tokens = []
    for ttype, pattern in TOKEN_PATTERNS:
        for m in re.finditer(pattern, code):
            tokens.append((m.start(), m.end(), m.group(), ttype))

    # 处理关键字（需要单独匹配，避免与函数名等冲突）
    if keywords:
        kw_pattern = r'\b(' + '|'.join(re.escape(k) for k in keywords) + r')\b'
        for m in re.finditer(kw_pattern, code):
            # 检查是否已被其他 token 覆盖
            overlap = False
            for s, e, _, _ in tokens:
                if m.start() >= s and m.end() <= e:
                    overlap = True
                    break
            if not overlap:
                tokens.append((m.start(), m.end(), m.group(), "keyword"))

    # 按起始位置排序
    tokens.sort(key=lambda t: (t[0], -(t[1] - t[0])))

    # 过滤重叠的 token（保留最长/最早匹配的）
    filtered = []
    last_end = 0
    for s, e, text, ttype in tokens:
        if s >= last_end:
            filtered.append((s, e, text, ttype))
            last_end = e

    # 构建 HTML —— 每段分别转义
    result = []
    pos = 0
    for s, e, text, ttype in filtered:
        if s > pos:
            result.append(_html.escape(code[pos:s]))
        color = COLORS.get(ttype, COLORS["text"])
        result.append(f'<span style="color:{color}">{_html.escape(text)}</span>')
        pos = e
    if pos < len(code):
        result.append(_html.escape(code[pos:]))

    return "".join(result)


def highlight_html(code, language="javascript"):
    """
    返回完整的 HTML 文档片段（不含 html/body 标签），
    适合放入 QTextBrowser 的 setHtml()。
    """
    highlighted = highlight(code, language)
    return f'<div style="font-family:Consolas,\'Courier New\',monospace;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-all;">{highlighted}</div>'
