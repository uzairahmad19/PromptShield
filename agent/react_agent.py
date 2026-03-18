"""
agent/react_agent.py
---------------------
LangChain ReAct agent wired to Ollama llama3.2.
Compatible with LangChain >= 0.2 and langchain-ollama >= 0.1
"""

import os
import yaml

from langchain_ollama import OllamaLLM
from langchain.agents import create_react_agent
from langchain.agents.agent import AgentExecutor          # moved here in v1.0+
from langchain_core.prompts import PromptTemplate

from agent.tools import get_all_tools
from agent.prompt_templates import REACT_PROMPT_TEMPLATE, SYSTEM_PROMPT


def load_config() -> dict:
    config_path = os.path.join(os.path.dirname(__file__), "..", "config.yaml")
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def build_llm() -> OllamaLLM:
    config = load_config()
    llm_cfg = config["llm"]
    return OllamaLLM(
        model=llm_cfg["model"],
        base_url=llm_cfg["base_url"],
        temperature=llm_cfg["temperature"],
    )


def build_prompt() -> PromptTemplate:
    """
    ReAct prompt. LangChain requires these four input variables:
    input, tools, tool_names, agent_scratchpad
    """
    template = REACT_PROMPT_TEMPLATE.replace(
        "{system_prompt}", SYSTEM_PROMPT
    )
    return PromptTemplate(
        input_variables=["input", "tools", "tool_names", "agent_scratchpad"],
        template=template,
    )


def build_agent(verbose: bool = True) -> AgentExecutor:
    llm    = build_llm()
    tools  = get_all_tools()
    prompt = build_prompt()

    agent = create_react_agent(llm=llm, tools=tools, prompt=prompt)

    return AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=verbose,
        handle_parsing_errors=True,
        max_iterations=8,
        max_execution_time=60,
        return_intermediate_steps=True,
    )


def run_agent(query: str, verbose: bool = True) -> dict:
    executor = build_agent(verbose=verbose)
    return executor.invoke({"input": query})
