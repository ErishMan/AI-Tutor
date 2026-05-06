# AI Tutor — Node.js/Express Backend

Socratic AI programming tutor backend. Powered by a local LLM via **LM Studio**.

## Project structure

```
src/
├── index.ts                      # Express server entry point
├── types/index.ts                # All shared TypeScript types
├── utils/logger.ts               # Winston logger
├── middleware/
│   ├── validate.ts               # Zod request validation
│   └── errorHandler.ts           # Global error handler
├── services/
│   ├── SessionStore.ts           # In-memory session store (swap for Redis in prod)
│   ├── LmStudioClient.ts         # LM Studio / OpenAI-compatible API client
│   ├── SignalExtractor.ts        # Pedagogical signal extraction (heuristics + LLM)
│   ├── PolicyEngine.ts           # Server-side guardrails & learner state updates
│   ├── TutorOrchestrator.ts      # Central decision loop
│   ├── SandboxExecutor.ts        # Safe code execution (vm2 / Python subprocess)
│   └── AssessmentService.ts     # Test scoring + qualitative LLM feedback
└── routes/
    ├── chat.ts                   # POST /chat
    ├── execute.ts                # POST /execute
    ├── session.ts                # GET|DELETE /sessions/:id, POST /sessions/:id/hint
    └── health.ts                 # GET /health
```

## Quick start

```bash
cp .env.example .env        # Fill in your LM Studio URL and model name
npm install
npm run dev                 # Starts with hot reload via tsx
```

## API reference

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | LM Studio ping + active session count |
| `POST` | `/chat` | Main tutor turn. Returns a `TutorDecision` |
| `POST` | `/execute` | Run learner code in sandbox |
| `GET`  | `/sessions/:id` | Fetch session summary & learner state |
| `DELETE` | `/sessions/:id` | End session |
| `POST` | `/sessions/:id/hint` | Request a Socratic hint (blocked in test mode) |

## Decision flow

```
User message
    │
    ▼
SignalExtractor  ──► confusion, frustration, mastery, plagiarism risk
    │
    ▼
PolicyEngine  ──► allowedModes (server-side guardrails, cannot be overridden)
    │
    ▼
TutorOrchestrator  ──► LLM call with learner state + allowed modes in system prompt
    │
    ▼
TutorDecision  ──► { mode, tutorMessage, sandboxTask?, testTask?, uiDirectives }
```

## Production notes

- Replace `SessionStore` with Redis for horizontal scaling.
- Replace `vm2` with a container-based executor (e.g. Firecracker microVMs) for untrusted code.
- Add JWT authentication middleware before routes.
- Set `ENABLE_CODE_EXECUTION=false` to disable execution entirely if running in a restricted environment.
