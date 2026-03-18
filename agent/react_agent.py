"""
agent/react_agent.py
---------------------
LangChain ReAct agent wired to Ollama llama3.2.

This is the TARGET system that PromptShield wraps around.
It knows NOTHING about the guardrail layers — it's a clean agent.
The PromptShield pipeline (pipeline/sieve.py) intercepts inputs/outputs
before and after this agent runs.

Architecture:
  LangChain AgentExecutor
    ├── LLM: Ollama (llama3.2)
    ├── Tools: web_search, file_reader, calculator
    ├── Prompt: ReAct format (Thought/Action/Observation)
    └── Output Parser: ReAct output parser

Usage:
    from agent.react_agent import build_agent
    agent = build_agent()
    result = agent.invoke({"input": "What is the capital of France?"})
    print(result["output"])
"""

import os
import yaml

from langchain_ollama import OllamaLLM
from langchain.agents import AgentExecutor, create_react_agent
from langchain.prompts import PromptTemplate

from agent.tools import get_all_tools
from agent.prompt_templates import REACT_PROMPT_TEMPLATE, SYSTEM_PROMPT


def load_config() -> dict:
    config_path = os.path.join(os.path.dirname(__file__), "..", "config.yaml")
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def build_llm() -> OllamaLLM:
    """
    Initializes the Ollama LLM.
    Requires `ollama serve` to be running on localhost.
    """
    config = load_config()
    llm_cfg = config["llm"]

    llm = OllamaLLM(
        model=llm_cfg["model"],           # "llama3.2"
        base_url=llm_cfg["base_url"],     # "http://localhost:11434"
        temperature=llm_cfg["temperature"],  # 0.0 for determinism
    )
    return llm


def build_prompt() -> PromptTemplate:
    """
    Builds the ReAct prompt template with our system prompt injected.
    LangChain requires these input variables: input, tools, tool_names, agent_scratchpad
    """
    prompt = PromptTemplate(
        input_variables=["input", "tools", "tool_names", "agent_scratchpad"],
        template=REACT_PROMPT_TEMPLATE.format(
            system_prompt=SYSTEM_PROMPT,
            input="{input}",
            tools="{tools}",
            tool_names="{tool_names}",
            agent_scratchpad="{agent_scratchpad}",
        ),
    )
    return prompt


def build_agent(verbose: bool = True) -> AgentExecutor:
    """
    Builds and returns a LangChain ReAct AgentExecutor.

    Args:
        verbose: If True, prints Thought/Action/Observation trace to stdout.
                 Set False in production; True for debugging.

    Returns:
        AgentExecutor ready to accept .invoke({"input": "..."}) calls
    """
    llm = build_llm()
    tools = get_all_tools()
    prompt = build_prompt()

    # create_react_agent wires: LLM + Tools + Prompt → ReAct agent
    agent = create_react_agent(llm=llm, tools=tools, prompt=prompt)

    # AgentExecutor handles the Thought/Action/Observation loop
    executor = AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=verbose,
        handle_parsing_errors=True,    # Don't crash on malformed LLM output
        max_iterations=8,              # Safety cap — prevents infinite loops
        max_execution_time=60,         # Timeout in seconds
        return_intermediate_steps=True,  # We need these for Layer 3 inspection
    )

    return executor


def run_agent(query: str, verbose: bool = True) -> dict:
    """
    Convenience function: build agent and run a single query.

    Returns a dict with:
        output:             str  — the agent's final answer
        intermediate_steps: list — [(AgentAction, observation), ...]
                                   Layer 3 inspects the observations here
    """
    agent = build_agent(verbose=verbose)
    result = agent.invoke({"input": query})
    return result
