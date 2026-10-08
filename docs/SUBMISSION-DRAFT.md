SMALL HOURS ARTICLE FOR REVIEW
Reviewed DEV article. Public source and demo links have been verified. This article has not been submitted to DEV.

DEV editor settings
Title: Small Hours uses local AI to plan a short break outside
Tags: devchallenge, hf26challenge
AI disclosure: Fully Autonomous
Partner categories: None claimed

ARTICLE TEXT

Prepared for the Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass.
Challenge: https://dev.to/challenges/hacktoberfest-week1-2026-10-05

AI disclosure: This article and the prototype were produced primarily by OpenAI Codex agents from the project direction and constraints I supplied. AI agents performed the research, design, implementation, activity writing, documentation, and recorded software checks. The results below describe those checks. They are not a claim that I manually wrote the code, independently audited it, or took the app outdoors.

What I Built

Small Hours starts with a narrow question: what could I do outside with the next 15 minutes?

You describe what sounds appealing, choose a time budget from 5 to 60 minutes, and set movement, surroundings, company, and daylight options. The app suggests a short outdoor activity with three timed steps and up to two alternatives.

The catalog contains 16 AI-authored activity types, including noticing colors from one spot, watching nearby movement, making a sound map, and looking for patterns on a familiar walk. A pocket view and text download let you keep the instructions without repeatedly returning to the planner.

A recorded test used the synthetic request “I want to quietly observe feathered wildlife while seated,” with 15 minutes, greenery, daylight, and solo activity selected. The local model chose “Watch a little wild activity.” Its plan reserved three minutes to settle at a familiar spot, nine to observe, and three to finish and return. It also suggested following a moving leaf or branch if no animal appeared.

These are generic activity ideas. The app does not find parks, verify opening hours, or promise wildlife sightings. You choose a familiar, permitted place and check whether the surroundings and journey suit you. A seated activity does not establish that a route or venue is accessible.

Demo

https://raw.githubusercontent.com/Aniket-pd/small-hours/dd1aa0b8c4738bdfb4ccc7807492c1067d86d235/evidence/browser/small-hours-local-demo.mp4

The demo is a 9.52-second recording of the actual local-model application. It shows a synthetic request, a returned plan, the pocket view, and an alternative. It has no audio and was recorded through automated browser interactions.

This is an indoor software demonstration. No outdoor field test or human usability trial has been conducted.

Code

https://github.com/Aniket-pd/small-hours

The README explains setup and reproduction. The application requires Node.js 22 or newer. Dependencies and model files need an initial network download; subsequent ranking runs locally on the CPU.

The repository should include the dependency lockfile, model revision and checksum, third-party notices, test scripts, and recorded evidence. Model weights and installed dependencies are downloaded separately rather than bundled with the source.

How I Built It

The AI has one job: rank eligible activity descriptions by semantic similarity.

First, ordinary code applies the selected constraints to the activity catalog. The remaining descriptions and the user's request are encoded with all-MiniLM-L6-v2. Cosine similarity determines their order, and the planner fills a three-step template with the chosen time budget.

The app uses the q8 ONNX export from Xenova/all-MiniLM-L6-v2, pinned to revision 751bff37182d3f1213fa05d7196b954e230abad9. Transformers.js 4.3.1 loads it through ONNX Runtime 1.30.0 on the CPU. The encoder produces 384-dimensional, normalized, mean-pooled embeddings. This project did not train or fine-tune the model.

This separation matters for constraints. Similarity can connect “feathered wildlife” with bird watching, but it is not a dependable interpreter of arbitrary negation. Explicit controls enforce firm limits before ranking. A small set of recognized phrases, such as “no walking” and “after dark,” can tighten those limits; other free text remains a preference.

The model also does not write the plan or invent place details. The activity descriptions and steps are fixed catalog content. Similarity scores are not confidence or safety scores.

A separate fixture mode makes interface review possible without installing a model. It uses word overlap and is labeled “no AI inference.” If the real model fails, the application reports an error rather than silently switching to the fixture.

What the Checks Establish

The recorded macOS arm64 run, using Node 24.8.0, passed 33 automated tests and 21 browser checks. Coverage includes constraint filtering, time totals, request validation, explicit model failures, alternatives, text exports, keyboard behavior, and responsive layouts from 320 to 1440 pixels.

Actual inference produced the expected embedding dimensions and normalization, and a controlled paraphrase check ranked bird watching above the other two candidates. During that model check, JavaScript fetch was blocked and zero calls were attempted. Browser checks observed zero external page requests. These are scoped software observations, not an operating-system packet capture.

The evidence also shows why semantic ranking needs evaluation. In one raw catalog test, a creative request mentioning sketching leaves ranked “Draw a place from memory” first. Similarity can return a broadly related activity without selecting the most literal one.

Linux execution, physical-device browsers, screen-reader use, physical printing, and outdoor usability remain untested. The current result is a working local prototype, with no measured evidence yet that it gets people outside more often.

Why Does Open Innovation Matter?

Open weights make local semantic matching practical without sending the prompt to a remote inference service or paying for each request. After setup, the application disables remote model loading and reads its pinned local files.

The application has no account system, analytics, database, cookies, or browser storage. User prompts stay in process memory; the saved test evidence uses synthetic inputs.

The model choice is inspectable and replaceable. The source identifies the exact export, runtime versions, and weight checksum. The upstream model and ONNX export declare Apache-2.0 licensing, and the project preserves their attribution alongside runtime notices.

With 16 activities, a filterable list would already be useful. Local embeddings add flexible matching for how someone describes a break. Their value here is a small, bounded use of AI that can run on a laptop. The next meaningful test is whether the resulting suggestion is easy enough to use that someone closes the screen and goes outside.

Credits

Source model: sentence-transformers/all-MiniLM-L6-v2
https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2

Pinned ONNX export: Xenova/all-MiniLM-L6-v2
https://huggingface.co/Xenova/all-MiniLM-L6-v2/tree/751bff37182d3f1213fa05d7196b954e230abad9

Transformers.js
https://github.com/huggingface/transformers.js

ONNX Runtime
https://github.com/microsoft/onnxruntime

The optional SerpApi adapter is disabled and unconnected to the application. No live search was performed and no partner-category use is claimed.
