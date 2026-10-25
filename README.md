<div align="center">
  <img src="friends-logo.png" alt="AImigos logo" width="160" />
  <h1>AImigos</h1>
  <p><strong>Your people. Your AI companions. One conversation.</strong></p>
</div>

## About the Project

AImigos is a social chat platform where people and personalized AI companions share the same conversation. It brings the familiarity of a group messenger together with AI assistance, so friends can brainstorm, study, make plans, and solve problems without switching between apps.

People remain at the center of the experience. AI companions participate when invited, contribute their own specialties, and use the conversation in that chat to provide relevant help. Users can also start private conversations with companions they create.

## The Problem

Group conversations and AI tools usually live in separate places. Someone asks an AI a question, copies the answer back into the group, and then repeats the process when the discussion changes. Context gets lost, and the rest of the group cannot participate directly.

AImigos brings that assistance into the shared conversation. Everyone can see the question, follow the response, and build on the idea together.

## What You Can Do

### Bring Your People Together

Create a group, choose a nickname, and invite others through a link or QR code. Messages arrive in real time and remain available when you return. The participant list separates people from AI companions, and members can leave a group without deleting its conversation for everyone else.

### Meet Zorad

Zorad is the default AI companion in every chat. Mention **@Zorad** to ask a question, explore an idea, or get help with a decision. Otherwise, it stays quiet. Zorad cannot be removed, and its profile is available in the companion Studio as a starting point for your own creation.

### Create Your Own AI Companions

The Studio lets you build companions with distinct personalities and purposes. Give a companion a name, avatar, specialty, personality, and instructions. Start from a template or create one from scratch, then choose preset skills or add custom skills to shape how it helps.

A coding buddy, a patient tutor, a brainstorming partner, or a companion focused on your favorite subject can each have a place in your personal library.

### Take Companions Into Different Conversations

Add a library companion to multiple groups or start a private AI chat. Each group receives its own configuration copy, so changes in one group do not overwrite another. Creators choose whether members can customize a group version or use the companion as a template.

### Ask Naturally

Typing **@** suggests the AI companions in the current group. Select a name and ask your question. Custom companions also support direct address and contextual follow-ups, while Zorad always requires an explicit mention. A private chat with one selected companion allows ordinary conversation without tagging it each time.

### See What Is Happening

Chat notices show when someone adds or removes a companion. An AI activity panel provides visibility into response times, model usage, token counts, and cost estimates when pricing is configured.

## Example Uses

| Situation | How AImigos helps |
| --- | --- |
| Studying with classmates | Bring a tutor into the discussion to explain concepts and work through questions together. |
| Planning with friends | Ask a companion to brainstorm activities or organize the group's ideas into a plan. |
| Building a project | Discuss an approach with teammates and ask a coding companion to review pasted code. |
| Creating something new | Collaborate with a creative companion on stories, names, concepts, and variations. |
| Exploring a personal interest | Create a specialized companion and talk with it privately. |

## How It Works

AImigos uses Supabase to manage browser-based anonymous identities, group membership, saved conversations, and live updates. When a message calls for an AI response, the server selects the companion and a configured Gemini model, uses recent messages from that room as context, and saves the reply for participants to see.

Companions have separate conversation contexts across rooms. Their personalities and skills guide their responses; they do not grant access to other chats or automatically enable external tools.

## Built With

| Technology | Role |
| --- | --- |
| Next.js and React | Application pages and interactive chat interface |
| TypeScript | Application logic and shared types |
| Supabase | Anonymous authentication, PostgreSQL storage, access policies, and real-time updates |
| Google Gemini | AI companion responses and conversational reasoning |
| CSS and Lucide | Responsive styling and interface icons |
| Docker and Caddy | Containerized hosting and HTTPS |
| Vultr | Cloud hosting infrastructure |

## Design Principles

- **Human-led conversation:** AI supports the discussion without taking it over.
- **Personalization:** Companions can reflect different interests, personalities, and ways of helping.
- **Shared participation:** Questions and AI responses are part of the conversation everyone can follow.
- **Room-level boundaries:** Membership controls access, and AI context stays within the current chat.
- **Visible AI identity:** Companions are clearly distinguished from human participants.

## Current Scope

AImigos supports text conversations, customizable companions, group and private AI chats, and persistent history. Skills work with text shared in chat; live web search, scraping, code execution, image conversations, and cross-chat memory are not currently implemented.

Identity is tied to the browser's anonymous session, so clearing browser storage can lose access to creator controls. AI generation currently runs within the sender's request, meaning the sender waits for the response while other group members can continue chatting.

## Project Structure

```text
src/app/                 Application pages and message API
src/components/          Chat interface and companion Studio
src/hooks/               Chat and editor state
src/lib/                 AI routing, provider integration, and shared logic
supabase/migrations/     Database schema and access rules
tests/                   Application and database tests
public/                  Logo and visual assets
```

---

**AImigos makes AI part of the conversation, alongside the people you want to share it with.**
