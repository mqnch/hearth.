# Project: AccessiVision (name tbd) (Backend Architecture)
**Role:** AI Backend Architect
**Goal:** Build a FastAPI service that performs a "Spatial Audit" on real estate photos using Gemini 1.5 Pro and generates renovated visualizations using Stability AI.

## 🛠️ Tech Stack
- **Framework:** FastAPI (Python 3.10+)
- **AI Logic:** Google Gemini 1.5 Pro (via `google-generativeai`)
- **Image Gen:** Stability AI API (or Imagen 3 via Vertex AI if configured)
- **Utilities:** Pillow (PIL) for image handling, Requests for API calls.

## 📂 File Structure
- `backend/main.py`: The API entry point.
- `backend/services.py`: The core logic (Gemini + Image Gen).
- `backend/.env`: Stores `GEMINI_API_KEY` and `STABILITY_KEY`.

---

## 📝 Implementation Details

### 1. `backend/services.py`

**Function: `audit_room(image_url: str) -> dict`**
- **Input:** A public image URL.
- **Action:**
  1. Download the image into memory (BytesIO).
  2. Send to Gemini 1.5 Pro with the following System Prompt:
     > "You are an expert Accessibility Architect (AODA compliant). Analyze this real estate photo.
     > Identify the single most critical accessibility barrier (e.g., stairs, narrow doorway, high tub).
     > Return a strict JSON object with these keys:
     > - `barrier_detected`: string (The issue found)
     > - `renovation_suggestion`: string (The fix, e.g., 'Install vertical platform lift')
     > - `estimated_cost_usd`: integer (Rough estimate)
     > - `compliance_note`: string (Reference standard codes like '1:12 slope ratio')
     > - `mask_prompt`: string (A visual description of the specific area to mask/erase for inpainting, e.g., 'the concrete stairs leading to the porch')
     > - `image_gen_prompt`: string (A prompt for the image generator to fill in the masked area, e.g., 'A modern wooden ramp with aluminum railings, photorealistic, 8k, cinematic lighting, keeping original siding style')"
- **Output:** The parsed JSON.

**Function: `generate_renovation(image_url: str, prompt: str, mask_prompt: str) -> bytes`**
- **Action:**
  1. Use the `requests` library to hit the Stability AI "Search and Replace" (Inpainting) endpoint.
  2. Endpoint: `https://api.stability.ai/v2beta/stable-image/edit/search-and-replace`
  3. Parameters:
     - `image`: The downloaded original image.
     - `prompt`: The `image_gen_prompt` from Gemini.
     - `search_prompt`: The `mask_prompt` from Gemini.
     - `output_format`: "webp"
- **Output:** Raw image bytes.

### 2. `backend/main.py`

- **Endpoints:**
  - `POST /analyze`:
    - Accepts JSON: `{ "image_url": "..." }`
    - Calls `audit_room` to get the plan.
    - Calls `generate_renovation` using the plan's prompts.
    - Returns JSON:
      ```json
      {
        "audit": { ...data from gemini... },
        "renovated_image_base64": "...base64 encoded string of the new image..."
      }
      ```
- **CORS:** Enable CORS for `["*"]` so the frontend can hit it.

---

## ⚠️ Critical Rules
1. **JSON Only:** Ensure Gemini is forced to return JSON (use `response_mime_type: "application/json"` in config).
2. **Error Handling:** Wrap all external API calls in try/except blocks. If Image Gen fails, return the Audit data with a `null` image to prevent a crash.
3. **Mocking (Optional):** If `GEMINI_API_KEY` is missing, return dummy data for testing purposes.