# Brief para agentes redactores de la Academia Dermalysse

You are writing educational content in Spanish (Mexico) for «Academia Dermalysse», a Cisco-Networking-Academy-style reading platform about skin science and professional cosmetology/aesthetics. Repo root: C:\dev\02_CLIENTES\Dermalysse\dermalysse-wt-academia

Dermalysse is its own brand. Never mention or copy other brands (OdonTeck, Visión Pecuaria, Élite Pecuario, DermaExpo, GlobalVet).

READ FIRST (mandatory):
1. docs/ACADEMIA-FORMATO.md — the exact JSON format and editorial rules.
2. docs/PLAN-ACADEMIA.md — scope and quality rules.
3. api/content/academia/catalogo.json — your program's module list. Module `titulo` must match the catalog EXACTLY.

WHAT TO PRODUCE: one file per module at api/content/academia/<program-id>/modulo-NN.json (two digits). For each module:
- 5 temas (4 to 6 allowed). Each tema 1,000–1,400 words of real teaching text (texto, recuadro, pasos, lista, tabla), at least 3 `figura` blocks with image prompts, at least 1 `diagrama`, at least 2 recuadros of different variants, at least 1 `actividad`, 3–8 glossary terms, exactly 3 verification questions, and sources. At least one `profundizar` recuadro per module.
- One minijuego. Type fixed by module number: 1,4,7,10 → `sopa`; 2,5,8,11 → `crucigrama`; 3,6,9,12 → `memorama`.
- Exam with 15–20 questions mixing recall, comprehension and applied cabin cases.
- ANSWER POSITIONS: spread the correct answer evenly across A, B, C and D in both exams and verification questions. No letter may hold more than 35 % of a module's exam answers. Write the options in natural order first, then place the correct one where the balance needs it.
- Think like the author of a university-level dermatology/cosmetology textbook who also writes clearly for a 16-year-old beginner. Use current knowledge (up to 2025/2026), Mexican context where relevant (COFEPRIS, Secretaría de Salud, climate and sun exposure in Mexico, diversity of phototypes in the Mexican population) and international references (WHO, American Academy of Dermatology, British Association of Dermatologists, peer-reviewed reviews, dermatology textbooks).

VALIDATION: after writing each module run `node scripts/academia/validar.mjs <program-id> --estricto` and fix every error for that module before moving on. Modules not yet written appear as «pendientes»; that is fine.

NON-NEGOTIABLE RULES:
- Technically correct. Never invent facts, figures, norms (NOM numbers), regulations, documents, authors, years or URLs. If unsure a source exists, don't cite it; use `"tipo": "propia"` with title «Elaboración propia Dermalysse con base en …». Only include `url` when certain. You may use WebSearch sparingly (a few searches per module at most) to confirm current data or regulations.
- Mexican norms/regulations: before citing any NOM or COFEPRIS rule, confirm with WebSearch that it exists AND is in force. If you cannot confirm, describe the requirement without the number and tell the reader to check COFEPRIS / the DOF.
- EDUCATIONAL, NEVER MEDICAL: do not diagnose, do not prescribe, do not promise results. No drug doses, no concentrations to prepare products, no medical protocols. Whenever skin disease, suspicious lesions or medical procedures come up, the instruction is to refer to a dermatologist. Medical procedures (botulinum toxin, fillers, medical lasers, deep medical peels) only to explain professional scope and referral.
- Diversity: examples and image prompts with different phototypes, ages and genders.
- No padding: never repeat sentences or write filler to reach word counts. Every paragraph must teach something new. Write the JSON by hand with the Write tool; do not generate content with templates or loops.
- Image prompts: Spanish, 60–140 words, realistic warm editorial photography (cream and dusty-rose tones, clean aesthetic cabin or studio, natural skin texture), correct PPE in cabin scenes, ending with «Evitar: …». Never ask for text inside the image; no identifiable real people; no graphic lesions; no miracle before/after. Image ids `<program-id>/mNN/NN` consecutive per module, portada `<program-id>/mNN/portada`, diagram ids `<program-id>/mNN/dN`.
- Avoid ASCII double quotes inside text values; use «» for quotes.
- Every module file has `"estado": "borrador"`.
- Only create files inside api/content/academia/<program-id>/. Do not edit any other file. Do not run git.
- Do NOT spawn helper agents: write every module yourself, one after another.

FINAL REPORT (short): modules written, total words and images from the validator's last line, and any facts you were unsure about and how you handled them.
