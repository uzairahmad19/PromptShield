import os
import math
import ast
import operator
import yaml
from pathlib import Path
from langchain.tools import Tool

# DuckDuckGoSearchRun moved in newer langchain-community versions
try:
    from langchain_community.tools import DuckDuckGoSearchRun
except ImportError:
    try:
        from langchain_community.tools.ddg_search.tool import DuckDuckGoSearchRun
    except ImportError:
        DuckDuckGoSearchRun = None


def _cfg():
    p = os.path.join(os.path.dirname(__file__), "..", "config.yaml")
    with open(p) as f:
        return yaml.safe_load(f)


def build_web_search_tool():
    if DuckDuckGoSearchRun is None:
        print("[tools] DuckDuckGoSearchRun not available — web_search disabled")
        return None
    search = DuckDuckGoSearchRun()
    return Tool(
        name="web_search",
        func=search.run,
        description=(
            "Search the web for current information. "
            "Input: a search query. Output: text snippet from results. "
            "Use when you need up-to-date facts."
        ),
    )


def _safe_read_file(file_path: str) -> str:
    c = _cfg()["tools"]["file_reader"]
    allowed = c.get("allowed_extensions", [".txt", ".md", ".json", ".csv"])
    max_kb  = c.get("max_file_size_kb", 500)

    if ".." in file_path:
        return "ERROR: path traversal not allowed"

    path = Path(file_path).resolve()

    if path.suffix.lower() not in allowed:
        return f"ERROR: file type '{path.suffix}' not allowed"
    if not path.exists():
        return f"ERROR: file not found: {file_path}"
    if path.stat().st_size / 1024 > max_kb:
        return f"ERROR: file too large (>{max_kb}KB)"

    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        return f"ERROR: {e}"


def build_file_reader_tool():
    return Tool(
        name="file_reader",
        func=_safe_read_file,
        description=(
            "Read a local file. Input: file path. "
            "Allowed: .txt, .md, .json, .csv. "
            "Use when the user asks about a specific file."
        ),
    )


_OPS = {
    ast.Add: operator.add, ast.Sub: operator.sub,
    ast.Mult: operator.mul, ast.Div: operator.truediv,
    ast.Pow: operator.pow,  ast.USub: operator.neg,
}
_FUNCS = {
    "sqrt": math.sqrt, "log": math.log, "log2": math.log2,
    "log10": math.log10, "sin": math.sin, "cos": math.cos,
    "tan": math.tan, "abs": abs, "round": round,
    "pi": math.pi, "e": math.e,
}


def _eval(node):
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp):
        t = type(node.op)
        if t not in _OPS: raise ValueError(f"unsupported op: {t}")
        return _OPS[t](_eval(node.left), _eval(node.right))
    if isinstance(node, ast.UnaryOp):
        t = type(node.op)
        if t not in _OPS: raise ValueError(f"unsupported unary: {t}")
        return _OPS[t](_eval(node.operand))
    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name): raise ValueError("only simple calls")
        fn = node.func.id
        if fn not in _FUNCS: raise ValueError(f"unknown function: {fn}")
        return _FUNCS[fn](*[_eval(a) for a in node.args])
    if isinstance(node, ast.Name):
        if node.id in _FUNCS: return _FUNCS[node.id]
        raise ValueError(f"unknown name: {node.id}")
    raise ValueError(f"unsupported node: {type(node)}")


def _calculate(expr: str) -> str:
    try:
        return str(_eval(ast.parse(expr.strip(), mode="eval").body))
    except ZeroDivisionError:
        return "ERROR: division by zero"
    except (ValueError, TypeError) as e:
        return f"ERROR: {e}"
    except Exception as e:
        return f"ERROR: {e}"


def build_calculator_tool():
    return Tool(
        name="calculator",
        func=_calculate,
        description=(
            "Evaluate math expressions. "
            "Supports: +, -, *, /, **, sqrt, log, sin, cos, tan, abs, round, pi, e. "
            "Input: expression like '2**10' or 'sqrt(144)'. Output: result."
        ),
    )


def get_all_tools():
    c = _cfg().get("tools", {})
    tools = []
    if c.get("web_search", {}).get("enabled", True):
        t = build_web_search_tool()
        if t:
            tools.append(t)
    if c.get("file_reader", {}).get("enabled", True):
        tools.append(build_file_reader_tool())
    if c.get("calculator", {}).get("enabled", True):
        tools.append(build_calculator_tool())
    return tools
