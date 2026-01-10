Phase 2: The "Spatial Audit" Brain (45 mins)

Goal: Get Gemini to "see" the barriers in the image.

    Prompt for Cursor:

        "@services.py @main.py Implement the audit_room function in services.py. It should take an image URL, use requests to get the image, and send it to Gemini 1.5 Pro. Use the 'Spatial Audit' system prompt from my instructions. Ensure Gemini returns a structured JSON. Test this by calling it from the /analyze endpoint and returning just the JSON to me."

    Felix's Job: Run the server (uvicorn main:app --reload) and test this endpoint with a real URL using the FastAPI /docs (Swagger) page.

Phase 3: The "Visualization" Eyes (1 hour)

Goal: Turn that audit into a real image.

    Prompt for Cursor:

        "@services.py @main.py Now implement generate_renovation using the Stability AI Search-and-Replace (Inpainting) API. It should take the original image, the image_gen_prompt, and the mask_prompt from Gemini. Handle the binary response and ensure it's passed back to main.py."

Phase 4: The "Integration" (30 mins)

Goal: Connect the two and return a Base64 string to the frontend.

    Prompt for Cursor:

        "Update the /analyze endpoint to orchestrate both steps. It should: 1. Audit the room. 2. Generate the new image. 3. Convert that image to a Base64 string. 4. Return the final JSON containing both the audit data and the image_data string. Add error handling so that if the image generation fails, I still get the Audit data."

Phase 5: The "Waterloo Flex" (Polishing)

Goal: Make it smarter and faster.

    Prompt for Cursor:

        "Refactor services.py to be more robust. Add a 'Feasibility Score' calculation logic (0-100) based on how complex the renovation is. Also, ensure the Gemini prompt specifically asks for AODA (Accessibility for Ontarians with Disabilities Act) compliance standards in the compliance_note field."