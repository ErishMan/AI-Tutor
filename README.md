# TutorAI — Socratic Programming Tutor

A full-stack AI programming tutor with a dynamic Socratic teaching engine.
Powered by a local LLM via LM Studio, Next.js frontend, and Node.js backend.

## Architecture

```
frontend/   Next.js 14 app — 3-pane UI (Sidebar, Chat, Editor/Test)
backend/    Node.js/Express — Orchestrator, Sandbox, Observer, Session
```

## Prerequisites

- Node.js 20+
- Python 3.11+ (for the sandbox executor)
- [LM Studio](https://lmstudio.ai) running locally on port 1234

## Quick Start

### 1. Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev          # http://localhost:3001
```

### 2. Frontend
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev          # http://localhost:3000
```

### 3. LM Studio
- Load any instruction-tuned model (Llama 3, Mistral, Qwen etc.)
- Start the local server on port 1234
- Enable JSON mode if your model supports it

## Key Files

| File | Purpose |
|---|---|
| `backend/src/prompts/tutor-system-prompt.md` | Full Sage persona + decision logic |
| `backend/src/services/TutorOrchestrator.ts`  | Core tutoring loop |
| `backend/src/services/ExecutionObserver.ts`  | Code execution → pedagogical observation |
| `backend/src/services/SandboxExecutor.ts`    | Isolated code runner |
| `frontend/src/hooks/useTutorSession.ts`      | All session state + API calls |
| `frontend/src/app/page.tsx`                  | 3-pane layout root |

## Tutor Modes

| Mode | When | Hints |
|---|---|---|
| `chat` | Confusion, rapport, concepts | Always |
| `sandbox` | Practice, experimentation | On request |
| `test` | Mastery assessment | Never |

## Environment Variables

### Backend `.env`
```
PORT=3001
CORS_ORIGIN=http://localhost:3000
LM_STUDIO_BASE_URL=http://localhost:1234/v1
LM_STUDIO_MODEL=local-model
SANDBOX_TIMEOUT_MS=8000
NODE_ENV=development
```
