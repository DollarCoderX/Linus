# UPDATE v2 — LINUS AI Desktop Assistant

> IMPORTANT:
> The assistant has been renamed from **Linus** to **Linus**.
> Every reference in the project should now use **Linus**.

---

# 1. Intelligent AI Routing

Linus should never always use the same AI model.

Instead, before every request, Linus must determine:

- What the user is asking.
- Whether tools are required.
- Which AI provider is most suitable.
- Whether multiple providers should cooperate.

The routing process should happen internally and remain invisible to the user.

Example:

User:

Open a folder named Linus.

Internal reasoning:

Understand request

↓

Determine this is a filesystem action

↓

Call filesystem tool

↓

open_folder("Linus")

↓

Verify folder exists

↓

Open folder

↓

Respond naturally

The user should only see the final response.

Never expose internal tool calls.

---

# 2. AI Provider Routing

Linus supports multiple AI providers.

Providers include:

- Groq
- Gemini
- OpenRouter
- Ollama
- Pollinations

Every provider has different strengths.

The router should intelligently choose providers.

Examples:

Simple conversation

→ Groq

Programming

→ Groq or OpenRouter

Complex reasoning

→ Gemini

Image generation

→ Pollinations by default

Extremely detailed image generation

→ Gemini Image if available

Vision tasks

→ Gemini

Offline mode

→ Ollama

If Groq supports image generation in the future, allow it to be used automatically.

If a provider fails, attempt fallback according to user preferences.

---

# 3. Image Generation Experience

Image generation should never open a browser.

Instead, images appear directly inside Linus.

When an image finishes generating:

The chat interface smoothly transforms into an image editor.

Animation:

Input bar

↓

Expands upward

↓

Generated image fades in

↓

Input merges with image viewer

↓

Editing interface appears

The interface contains:

Top Bar

Download

Share

Close

Center

Large preview image

Bottom

Prompt input

Edit prompt

Generate variations

Upscale (future)

When the user presses Close:

The image viewer smoothly collapses.

The interface returns to the floating input.

The transition should feel similar to Apple's shared element animations.

---

# 4. Search Results UI

Search results should not open Chrome by default.

Linus should first display results inside its own interface.

Support:

Images

News

Videos

Web pages

YouTube

Shopping (future)

Academic papers (future)

Example:

Search for five German Shepherd images.

Result:

Five image cards appear.

Clicking an image:

Image expands.

Input merges underneath.

The user can ask:

"Edit this."

"Find more like this."

"Explain this image."

"Download."

The same experience should work for:

Videos

News

Articles

YouTube

Pressing Ctrl + P hides all previews with a smooth fade animation.

---

# 5. Search Providers

Support:

SERPER_API_KEY

Google Custom Search API

The search layer should support:

Images

News

Videos

General search

Knowledge Graph

Future providers should be pluggable.

---

# 6. Built-in Shell Environment

Linus owns several internal workspaces.

These are NOT external applications.

They are native Linus environments.

Workspaces:

Browser

Notes

Code Editor

Terminal

Calculator

The Browser should:

Open websites

Search

Navigate

Use AI assistance

Take screenshots

Analyze pages

The Notes workspace supports:

Markdown

Rich text

AI summaries

The Code workspace supports:

Syntax highlighting

AI coding assistance

File editing

Project browsing

Terminal workspace connects securely to Windows PowerShell.

Commands execute inside Linus while controlling the real Windows shell.

---

# 7. Streaming Task Execution

Long-running tasks should feel continuous.

Example:

Install dependencies.

Linus should:

Think

↓

Run command

↓

Read output

↓

Continue automatically

↓

Handle errors

↓

Continue

↓

Finish

The user should feel like Linus is actively working instead of repeatedly asking for confirmation.

---

# 8. Smarter Tool Calling

Linus should behave like an intelligent agent.

The AI does not directly execute actions.

Instead:

User request

↓

Understand intent

↓

Plan

↓

Choose skill

↓

Choose provider

↓

Choose tools

↓

Execute

↓

Observe

↓

Verify

↓

Respond

Tool execution is completely hidden from the user.

---

# 9. Universal Computer Access

Linus should locate and interact with:

Applications

Folders

Files

Executables

Shortcuts

If the requested item exists, Linus should attempt to find it.

Examples:

Open Photoshop.

Open Downloads.

Open Linus folder.

Open project named Website.

Open latest PDF.

Always verify before reporting success.

---

# 10. Skills System

Expand built-in skills.

Default skills:

Assistant

Agent

Planner

Teacher

Coder

Browser

Researcher

Writer

Developer

Data Analyst

Windows Automation

Terminal Expert

Image Editor

Vision Analyst

Designer

Translator

Math

Presentation Creator

Spreadsheet Assistant

Email Assistant

Calendar Assistant

Support custom user-created skills.

Custom skills define:

Name

Description

Prompt

Allowed tools

Preferred AI provider

Personality

Users should be able to export and import skills.

---

# 11. Dynamic Animated Border

The animated border should react to activity.

Every major task receives a unique animation.

Examples:

Idle

Slow flowing rainbow.

Searching

Moving blue waves.

Image generation

Purple and pink energy.

Reasoning

Orange and violet.

Tool execution

Circular motion.

Voice listening

Gentle pulse.

Speaking

Audio-reactive glow.

Errors

Red ripple.

Success

Soft green pulse.

The animation should always feel alive.

---

# 12. Menus

Every popup should automatically close when the user clicks outside of it.

Support:

Provider selector

Settings

Image viewer

Search previews

Skill selector

Context menus

---

# 13. Ollama Optimization

Improve local model performance.

Requirements:

Keep Ollama loaded in memory.

Reuse active sessions.

Stream responses immediately.

Reduce startup delay.

Support multiple local models.

Automatically detect running Ollama instances.

---

# 14. Chat Experience

While Linus is generating:

The Send button transforms into a Stop button.

Pressing Stop immediately cancels generation.

Streaming should stop gracefully.

---

# 15. Voice Experience

Responses should stream naturally.

Linus begins speaking while text is still being generated.

Speech should continue until generation ends.

Avoid voice interruptions.

Avoid speech being cut off.

Use buffered streaming.

Speech should remain synchronized with generated text.

---

# 16. Final Naming

Every reference to "Linus" throughout the project should be renamed to "Linus".

Variable names

Folders

Classes

UI

Settings

Documentation

Comments

Configuration

Everything should consistently use the new name.


# 17. Adaptive Interface Modes

Linus supports multiple interface modes depending on where the floating assistant is positioned.

The interface should smoothly transition between modes with shared element animations.

No mode should feel like opening a different application.

Everything should feel like one continuous interface.

---

## Mode 1 — Floating Assistant

Default mode.

A compact floating assistant.

Contains:

• AI provider icon
• Input
• Animated border
• Close button

Designed for:

Quick questions.

Commands.

Fast AI interaction.

---

## Mode 2 — Expanded Assistant

Clicking Expand or pressing the configured shortcut enlarges the assistant.

The user gains access to:

Recent conversations

History

Pinned chats

Settings

Memory

Model selector

Skills

Attachments

This mode remains lightweight.

---

## Mode 3 — Desktop Workspace

When the user drags the floating assistant to the top edge of the screen, Linus should smoothly snap into Desktop Workspace Mode.

This should feel similar to how Windows maximizes a window when dragged to the top, but with a custom animation.

Animation:

Floating Assistant

↓

Expands

↓

Toolbar appears

↓

Sidebar fades in

↓

Workspace loads

The transition should use shared element animations.

Never abruptly replace the UI.

---

Desktop Workspace contains:

Left Sidebar

• Chats
• Search
• Memory
• Skills
• Browser
• Notes
• Code
• Terminal
• Calculator
• Settings

Center

Conversation

Right Sidebar (optional)

Current task

Tool activity

Model information

Running processes

Recent files

Workspace tabs

---

The floating assistant and Desktop Workspace are the same application.

They share:

Conversation

Memory

Current task

Streaming

Provider

Voice

Tool state

Switching between modes should never interrupt an active conversation.