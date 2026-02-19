# Does it Gleam?

Inspired by the [Convex LLM Leaderboard](https://www.convex.dev/llm-leaderboard/) I thought it would be cool to do the same for Gleam.

I started a more ambitious project in the past, but archived it, due to the lack of personal necessity (https://github.com/daniellionel01/gleam-llm).

However a concise and useful overview of the ability of LLMs to solve small problems using Gleam.

## Methodology

Models are going to be faced with 2 challenges: Knowledge about the Gleam programming language and small coding challenges.

To get a deeper understanding of the models we are testing, we will run the same coding challenges for more popular programming languages, guaranteed to be well understood by all LLMs. Those will be: TypeScript (via Node), Python, Go.

Models are going to have multiple attempts.

In the coding challenges, models will have 3 attempts and will be given the compiler output to refine their code.

The models will have no access to external Tools, such as Web Browsing.

## Models

We will be using [OpenRouter](https://openrouter.ai/) for accessing the models.
Temperature for all models will be set to `0.1`.

We will test a wide range of models from past years and multiple providers.

Models we are testing:
- https://openrouter.ai/anthropic/claude-sonnet-4.6 ()
- https://openrouter.ai/anthropic/claude-opus-4.6
- https://openrouter.ai/z-ai/glm-5
- https://openrouter.ai/z-ai/glm-4.7
- https://openrouter.ai/moonshotai/kimi-k2.5
- https://openrouter.ai/moonshotai/kimi-k2-thinking
- https://openrouter.ai/minimax/minimax-m2.5
- https://openrouter.ai/minimax/minimax-m2.1
- https://openrouter.ai/openai/gpt-5.2-codex
