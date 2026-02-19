# Specification

We need a tool set to run the tests defined @README.md against the suite defined in @CHALLENGES.md.

Visualization Format should be an html file generated from raw JSON data.

OpenRouter API KEY is in `.env` as `OPENROUTER_API_KEY`

## Tech Stack

Open for suggestions.

## Important

- We want to be resourceful with requests. That means we do not want to have to run the whole test suite every time.
There has to be a way to cache und store results on disk so that cancelling and rerunning the test suite picks up
where it left off.

- We want to track costs and token usage for each test we run with the model.

- Every model will be run 10x against each test. This is to collect data and avoid "unlucky" runs. Differences in results will be calculated at the end in a standard deviation.

## System Prompt
```
You are an expert programmer. Your task is to provide a code solution within a single Markdown code block for the given programming problem. Do not include any direct execution commands, test cases, or usage examples within the code block.
```
