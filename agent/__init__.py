def build_agent(verbose=True):
    from agent.react_agent import build_agent as _b
    return _b(verbose=verbose)

def run_agent(query, verbose=True):
    from agent.react_agent import run_agent as _r
    return _r(query, verbose=verbose)

def get_all_tools():
    from agent.tools import get_all_tools as _t
    return _t()
