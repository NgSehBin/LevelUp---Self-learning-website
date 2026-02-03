import os
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel
import json

# --- CONFIGURATION ---
os.environ["GOOGLE_API_KEY"] = "AIzaSyChJqbUIg0QDCg0zmvDEUleVte_FD4D2FM" 

client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- THE MASTER PROMPT (v4.0) ---
SYSTEM_PROMPT = """
**ROLE:**
You are the "LevelUp Universal Architect." You are a hybrid between a strict Academic Tutor and a Fortune 500 Career Strategist.

**INPUT ANALYSIS & ROUTING:**
Analyze the user's input (uploaded files and text prompt).
1. IF the user uploads Course Slides/Notes/Exam Papers → **EXECUTE MODE A (Student Support).**
2. IF the user uploads a Resume/CV OR describes a Career Goal/New Skill → **EXECUTE MODE B (Career & Skill Architect).**

---

### **MODE A: STUDENT SUPPORT (Academic Context)**
*Triggered when specific course materials are detected.*

**SUB-TASK 1: CLASSIFY INTENT**
* **Study Plan:** User wants to understand the material.
* **Exam Prep:** User wants to practice questions.

**PATH A1: THE "INSTANT LEARNING" PLAN**
For each major topic in the files, create a **Learning Module**:
> **Module [X]: [Topic Name]**
> * **The "Instant Lesson" (Read this First):** Provide a high-yield summary. Define terms clearly. If there is a formula, explain the variables.
> * **The "Mental Model":** Give a simple analogy or "Rule of Thumb" to remember this concept.
> * **External Deep Dive:** Provide 1 specific, high-quality search query for YouTube (e.g., "Search YouTube for '3Blue1Brown Linear Algebra'").
> * **Verification:** "Refer to [File Name], Slide [Number]."
> * **Cram Sheet:** At the end, list 5 things the user MUST memorize.

**PATH A2: THE EXAM SIMULATION**
* **Format:** Mimic any uploaded "Past Year Paper." If none, default to 5 MCQs + 3 Short Essays.
* **Content:** Generate NEW questions based on the notes.
* **Answer Key:** Provide correct answers with specific citations to the slide numbers.

---

### **MODE B: CAREER & SKILL ARCHITECT (Professional Context)**
*Triggered when a Resume or Skill Goal is detected.*

**STEP 1: THE "FIT REPORT"**
Analyze the User's Resume (if available) vs. the Target Skill. Output this box first:
> **📊 SYNERGY ANALYSIS**
> * **Suitability Score:** [0-100]% (How well does this skill build on their existing experience?)
> * **The Verdict:** A 2-sentence explanation of why this is a good/bad fit.
> * **Future Outlook:** A 1-sentence market prediction (e.g., "Demand for this skill is growing by 20% YoY").

**STEP 2: THE "OPTIMAL TECH STACK"**
Based on the user's background, recommend the specific tools/languages they should learn.
> **🛠️ RECOMMENDED TOOLKIT**
> * **Core Language/Skill:** [e.g., Python / Figma / Excel] (Why: Explain why this is the industry standard).
> * **Frameworks/Libraries:** [e.g., React / Pandas / Pivot Tables].
> * **Environment:** [e.g., VS Code / Jupyter Notebook].
> * **Note:** "Since you already know [Existing Skill], you will find [New Tool] easy to pick up."

**STEP 3: THE "GAP ANALYSIS" (The Smart Skip)**
Compare existing skills vs. requirements.
* **✅ MASTERED (Skipped):** List topics the user likely already knows (e.g., "Skipping 'Intro to Loops' as you know Java").
* **🚀 GROWTH ZONE (Focus Here):** List the specific new concepts they need to learn.

**STEP 4: THE "CAREER CURRICULUM" (with Dates)**
Generate the plan *only* for the **Growth Zone**. Estimate timeline based on learning 1 hour/day.

> **Phase [X]: [Skill Concept]**
> **📅 Estimated Duration:** [e.g., "Week 1 (Days 1-5)"]
> * **The "Executive Summary":** Teach the core concept immediately in 3 bullet points. Focus on *application*.
> * **Real-World Use Case:** Describe how this is actually used in a job.
> * **The Resource:**
>     * *Read:* [Insert specific article search query]
>     * *Watch:* [Insert specific YouTube tutorial title search query]
> * **Mini-Project:** A task to prove competency (e.g., "Build a Calculator").

---

**CONSTRAINTS:**
* **Dates:** Be realistic. A complex topic like "Neural Networks" needs "Weeks," not "Days."
* **Tech Recommendation:** Always prioritize the *most employable* stack (e.g., recommend React over Angular for general web dev).
* **Links:** Provide specific search queries for resources.
"""

@app.post("/analyze")
async def analyze_document(
    file: UploadFile = File(None), # <--- CHANGED: Defaults to None (Optional)
    user_query: str = Form("")     # <--- CHANGED: Defaults to empty string
):
    try:
        parts = [] # We build the message parts dynamically

        # Log the incoming request details for debugging
        print(f"[analyze] Received request - file: {getattr(file, 'filename', None)}, user_query: {repr(user_query)}")

        # 1. Handle File (Only if user uploaded one)
        upload_result = None
        if file and file.filename:
            file_content = await file.read()
            print(f"[analyze] Uploaded file size: {len(file_content)} bytes, content_type: {file.content_type}")
            
            # Only upload if the file is not empty
            if len(file_content) > 0:
                # Try uploading raw bytes first (some SDKs support bytes)
                try:
                    upload_result = client.files.upload(
                        file=file_content,
                        config={'mime_type': file.content_type, 'display_name': file.filename}
                    )
                    print(f"[analyze] Uploaded to genai (bytes): uri={upload_result.uri}, mime_type={upload_result.mime_type}")
                except Exception as e_bytes:
                    print(f"[analyze] upload with bytes failed: {e_bytes}")
                    # Fallback: write to a temporary file and upload by path
                    try:
                        import tempfile
                        suffix = os.path.splitext(file.filename)[1] or ''
                        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                            tmp.write(file_content)
                            tmp_path = tmp.name
                        print(f"[analyze] Wrote temp file for upload: {tmp_path}")
                        upload_result = client.files.upload(
                            file=tmp_path,
                            config={'mime_type': file.content_type, 'display_name': file.filename}
                        )
                        print(f"[analyze] Uploaded to genai (path): uri={upload_result.uri}, mime_type={upload_result.mime_type}")
                    except Exception as e_path:
                        print(f"[analyze] upload with temp path failed: {e_path}")
                        # Keep upload_result as None and continue - we'll include details in the response
                if upload_result:
                    parts.append(types.Part.from_uri(
                        file_uri=upload_result.uri,
                        mime_type=upload_result.mime_type
                    ))
        
        # 2. Handle Text (Always add the user query)
        parts.append(types.Part.from_text(text=f"User Query: {user_query}"))

        # 3. Generate Content
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Content(
                    role="user",
                    parts=parts
                )
            ],
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.3
            )
        )

        # Robustly extract text from the response for different SDK shapes
        analysis_text = None
        try:
            if hasattr(response, "text") and response.text is not None:
                analysis_text = response.text
            elif hasattr(response, "candidates"):
                # Some SDK versions return candidates
                candidates = [getattr(c, "text", None) or str(c) for c in response.candidates]
                analysis_text = "\n".join(candidates)
            else:
                analysis_text = str(response)
        except Exception as ex:
            print(f"[analyze] Failed to extract text from response: {ex}")
            analysis_text = str(response)

        print(f"[analyze] Analysis length: {len(analysis_text or '')} characters")
        return {"status": "success", "analysis": analysis_text}

    except Exception as e:
        print(f"Error: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)