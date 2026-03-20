import os
import threading
import yaml

from langchain_ollama import OllamaLLM
from langchain.agents import create_react_agent
from langchain.agents.agent import AgentExecutor
from langchain_core.prompts import PromptTemplate

from agent.tools import get_all_tools
from agent.prompt_templates import REACT_PROMPT_TEMPLATE, SYSTEM_PROMPT


def _cfg():
    p = os.path.join(os.path.dirname(__file__), "..", "config.yaml")
    with open(p) as f:
        return yaml.safe_load(f)


def build_llm():
    c = _cfg()["llm"]
    # FIX: respect OLLAMA_BASE_URL env override (set in .env)
    base_url = os.environ.get("OLLAMA_BASE_URL", c["base_url"])
    return OllamaLLM(model=c["model"], base_url=base_url, temperature=c["temperature"])


def build_prompt():
    template = REACT_PROMPT_TEMPLATE.replace("{system_prompt}", SYSTEM_PROMPT)
    return PromptTemplate.from_template(template)


# FIX: cache the AgentExecutor — building it re-loads the LLM connection on every call,
# adding latency and wasting resources. Use a lock for thread safety.
_agent_executor: "AgentExecutor | None" = None
_agent_lock = threading.Lock()


def build_agent(verbose: bool = True) -> AgentExecutor:
    global _agent_executor
    if _agent_executor is None:
        with _agent_lock:
            if _agent_executor is None:
                llm    = build_llm()
                tools  = get_all_tools()
                prompt = build_prompt()
                agent  = create_react_agent(llm=llm, tools=tools, prompt=prompt)
                _agent_executor = AgentExecutor(
                    agent=agent, tools=tools, verbose=verbose,
                    handle_parsing_errors=True,
                    max_iterations=10, max_execution_time=90,
                    return_intermediate_steps=True,
                    early_stopping_method="force"
                )
    return _agent_executor


def run_agent(query: str, verbose: bool = True) -> dict:
    return build_agent(verbose=verbose).invoke({"input": query})
