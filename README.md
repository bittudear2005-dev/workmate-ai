# Workmate — AI Productivity Workspace

Workmate is a working personal productivity assistant built for the **Nebius x NVIDIA Global AI Hackathon**. It combines tasks, goals, notes, files, spreadsheets, persistent conversations, and NVIDIA Nemotron intelligence in one web application.

## Hackathon alignment

- **Track:** Best Apps and Agents
- **Primary AI platform:** Nebius Token Factory OpenAI-compatible API
- **Required model family:** NVIDIA Nemotron
- **Fallback providers:** Gemini and Groq

Workmate sends productivity requests to NVIDIA Nemotron models through Nebius Token Factory. Set `NEBIUS_API_KEY` and select the Nemotron model available to your Token Factory account.

## Features

- Task planning, prioritization, completion, and quick capture
- Goal planning with milestones and success metrics
- Note capture and AI summarization
- File uploads, spreadsheets, persistent history, and dashboard views
- AI chat with contextual task, goal, and note workflows
- Secure account registration and JWT authentication
- Serverless deployment on Vercel

## Nemotron setup

1. Create an API key in Nebius Token Factory.
2. Choose a Nemotron model exposed by your account.
3. Configure these environment variables:

```text
NEBIUS_API_KEY=your_key
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1/
NEBIUS_MODEL=nvidia/NVIDIA-Nemotron-Nano-9B-v2
```

The default model ID is configurable because Nebius Token Factory model availability can vary by account and region. Exact model IDs visible under your Token Factory account should be used in `NEBIUS_MODEL`.

## Local development

```bash
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
cd backend
python main.py
```

Open `http://localhost:8000`.

## Deployment

Workmate is deployed as a FastAPI application on Vercel using `api/index.py`. Add `NEBIUS_API_KEY`, `NEBIUS_BASE_URL`, and `NEBIUS_MODEL` as Vercel environment variables. SQLite data stored under `/tmp` is ephemeral; production persistence should use a managed database with `DATABASE_URL`.

## Public demo

https://workmate-ai-sooty.vercel.app

## Open source license

MIT License — see [LICENSE](LICENSE).

## Technology feedback

The Nebius integration uses the documented OpenAI-compatible chat completions interface, allowing NVIDIA Nemotron models to be selected without changing Workmate's application API. Environment-based configuration makes model rollout, fallback handling, and credit-efficient provider selection practical.
