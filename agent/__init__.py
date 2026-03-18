"""PromptShield Agent module."""
# Lazy imports to avoid triggering LangChain loading at import time
def build_agent(verbose=True):
    from agent.react_agent import build_agent as _build
    return _build(verbose=verbose)

def run_agent(query, verbose=True):
    from agent.react_agent import run_agent as _run
    return _run(query, verbose=verbose)

def get_all_tools():
    from agent.tools import get_all_tools as _tools
    return _tools()

__all__ = ["build_agent", "run_agent", "get_all_tools"]
