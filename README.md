# Does it Gleam?

Inspired by the [Convex LLM Leaderboard](https://www.convex.dev/llm-leaderboard/) I thought it would be cool to do the same for Gleam.

I started a more ambitious project in the past, but archived it, due to the lack of personal need for it (https://github.com/daniellionel01/gleam-llm).

However a concise and useful overview of the ability of LLMs to solve small problems using Gleam.

## Methodology

Models are going to be faced with multiple coding challenges with easily verifiable outputs (numbers or strings).

Models are going to have multiple attempts.

Instead of only accepting 1-shotted solutions, each model will have 3 attempts and will be given the compiler output to refine their code if their solution is not correct.

We will run each model 10x on each test and measure their standard deviation.

The models will have no access to external Tools, such as Web Browsing.

A final 0-100 score will be averaged for each model.

## Concessions

To manage expectations, it is vital to understand that leetcode style coding questions are not the full picture of how productive a LLM will be in a given programming language. There is a lot missing in this simplified test:
- Knowledge about best practices, anti patterns and design choices.
- Knowledge about the ecosystem.
- Tooling around documentation and MCP servers.
- Deprecated and new features in recent releases (due to knowledge cutoff).
- ...

Even if a model is not able to produce correct Gleam code from scratch, your experience in the real world in an existing codebase will most likely differ a lot. In a different context with Claude Code, existing code and access to web browsing, I expect any LLM to at least be sort of viable in a Gleam codebase.

## Coding Challenges

- Matrix Multiplication
- Write a test 
- FizzBuzz
- Write a fibonacci function and output `fib(10)`
- JSON de- and encoder
- Working with records
- Working with tuples
- List patterns
- Advent of Code

## Models

We will be using [OpenRouter](https://openrouter.ai/) for accessing the models.

We will test a wide range of models from past years and multiple providers.

Models we are testing:

| Name | Provider | Release date |
| --- | --- | --- |
| [claude-opus-4.6](https://openrouter.ai/anthropic/claude-opus-4.6) | [anthropic](https://www.anthropic.com/) | Feb 4, 2026 |
| [claude-sonnet-4.6](https://openrouter.ai/anthropic/claude-sonnet-4.6) | [anthropic](https://www.anthropic.com/) | Feb 17, 2026 |
| [claude-opus-4.5](https://openrouter.ai/anthropic/claude-opus-4.5) | [anthropic](https://www.anthropic.com/) | Nov 24, 2025 |
| [claude-sonnet-4.5](https://openrouter.ai/anthropic/claude-sonnet-4.5) | [anthropic](https://www.anthropic.com/) | Sep 29, 2025 |
| [gemini-3-pro-preview](https://openrouter.ai/google/gemini-3-pro-preview) | [google](https://ai.google.dev/) | Nov 18, 2025 |
| [gemini-3-flash-preview](https://openrouter.ai/google/gemini-3-flash-preview) | [google](https://ai.google.dev/) | Dec 17, 2025 |
| [gemini-2.5-pro](https://openrouter.ai/google/gemini-2.5-pro) | [google](https://ai.google.dev/) | Jun 17, 2025 |
| [gemini-2.5-flash](https://openrouter.ai/google/gemini-2.5-flash) | [google](https://ai.google.dev/) | Jun 17, 2025 |
| [glm-5](https://openrouter.ai/z-ai/glm-5) | [z-ai](https://z.ai/) | Feb 11, 2026 |
| [glm-4.7](https://openrouter.ai/z-ai/glm-4.7) | [z-ai](https://z.ai/) | Dec 22, 2025 |
| [kimi-k2.5](https://openrouter.ai/moonshotai/kimi-k2.5) | [moonshotai](https://www.moonshot.cn/) | Jan 27, 2026 |
| [kimi-k2-thinking](https://openrouter.ai/moonshotai/kimi-k2-thinking) | [moonshotai](https://www.moonshot.cn/) | Nov 6, 2025 |
| [minimax-m2.5](https://openrouter.ai/minimax/minimax-m2.5) | [minimax](https://www.minimaxi.com/) | Feb 12, 2026 |
| [minimax-m2.1](https://openrouter.ai/minimax/minimax-m2.1) | [minimax](https://www.minimaxi.com/) | Dec 23, 2025 |
| [deepseek-v3.2](https://openrouter.ai/deepseek/deepseek-v3.2) | [deepseek](https://www.deepseek.com/) | Dec 1, 2025 |
| [deepseek-r1](https://openrouter.ai/deepseek/deepseek-r1) | [deepseek](https://www.deepseek.com/) | Jan 20, 2025 |
| [gpt-5.2-codex](https://openrouter.ai/openai/gpt-5.2-codex) | [openai](https://openai.com/) | Jan 14, 2026 |
| [gpt-5.2](https://openrouter.ai/openai/gpt-5.2) | [openai](https://openai.com/) | Dec 10, 2025 |

## Development

This project is heavily vibe coded regarding the collection of scripts that run the actual tests. An initial draft of this "engine" is defined in [SPEC.md](./SPEC.md).

## Visualizations

- Table (by provider / date)
- Score vs date of release
- Score vs Model
- Closed vs Open weight models

## Inspiration

This project was also inspired by https://github.com/Tencent-Hunyuan/AutoCodeBenchmark!
