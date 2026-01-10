# Project: AccessiVision (name tbd) (Hackathon Spec)
**Goal:** A real estate accessibility visualizer.
**Architecture:** Monorepo (FastAPI Backend + Next.js Frontend).

---

## 🐍 Backend Spec (Target: `backend/`)
**Stack:** FastAPI, Python 3.10+, Gemini 1.5 Pro, Stability AI.

### 1. `backend/services.py`
- **Logic:**
  - `audit_room(image_url)`:
    - Downloads image.
    - Sends to **Gemini 1.5 Pro**.
    - System Prompt: "Analyze for accessibility barriers. Return strict JSON: `{ barrier: str, fix: str, cost: int, mask_prompt: str, gen_prompt: str }`."
  - `generate_renovation(image_url, prompt, mask_prompt)`:
    - Sends to **Stability AI Inpainting API** (`stable-image/edit/search-and-replace`).
    - Returns raw image bytes.

### 2. `backend/main.py`
- **Endpoint:** `POST /analyze`
- **Input:** `{ "image_url": "https://..." }`
- **Process:**
  1. Call `audit_room`.
  2. Call `generate_renovation` using the prompts from the audit.
  3. Encode the resulting image to Base64.
- **Output:**
  ```json
  {
    "audit": { ...json_data... },
    "image_data": "data:image/webp;base64,..."
  }