# Landing page design reference

Current implementation as of October 25, 2026. Update this reference when the design changes.

## Purpose and visual direction

A simple social chat entrance with two choices: **Create a chat** and **Join a chat**. The design uses a messenger-inspired teal accent, a medium-light, softened aqua background, rounded surfaces, and minimal branding. There are no promotional headings, decorative illustrations, or arrow icons beside the actions.

## Layout

- Route: `/`.
- Full viewport height (`100svh` minimum), with the actions centered horizontally and vertically.
- Page padding: 88px vertically and 24px horizontally.
- Top-left branding: message icon followed by `friends.`; the dot uses the teal accent.
- Desktop: two equal columns within a 486px maximum-width group, with a 10px gap. Each action is approximately 238px wide and 167px tall, with 15px padding and a 12px corner radius.
- Each action places its icon at the upper left and label at the lower left.
- At viewport widths of 560px or less: actions stack vertically, the group has a 253px maximum width, and actions are 134px tall with 13px padding.
- Brand position: 34px from the top and 42px from the left; 26px from both edges on mobile.

## Colors

| Role | Value |
| --- | --- |
| Solid page background | `#B8DFE3` |
| Primary action / brand dot / join icon | `#128C9E` |
| Primary action hover | `#0D7484` |
| Primary action text / join surface / dialog surface | `#FFFFFF` |
| Brand and join action text | `#193A40` |
| General and dialog text | `#182C30` |
| Join action and dialog border | `#DBE5E5` |
| Join action hover / join icon surface | `#EDF7F8` |
| Join action hover border | `#90C6CE` |
| Join icon border | `#D6ECEF` |
| Keyboard focus outline | `#086778` |
| Dialog label | `#526B70` |
| Dialog close icon | `#62777B` |
| Input surface | `#F7FAFA` |
| Input border | `#CDDCDE` |
| Form error | `#AE3349` |
| Dialog backdrop | `#18383F55` (with alpha) |

The CSS custom properties `--landing-accent` and `--landing-accent-hover` control the main accent colors. The background is a single solid color, with no gradient.

## Typography and icons

Font: **DM Sans**. Category: **sans-serif**. Fallback: system `sans-serif`. Loaded through the Google Fonts import in `globals.css`.

| Role | CSS token | Font size | Weight / alignment |
| --- | --- | --- | --- |
| Create/share page and join dialog titles | `--text-title` | 30px | 700; left on forms, centered on invite screen |
| Brand | `--text-brand` | 25px | 700 |
| Buttons, landing labels, Back link | `--text-action` | 20px | 600; Back uses 500 |
| Body and editable inputs | `--text-body` | 16px | 400; line-height 1.5 |
| Labels, hints, errors, invite URL and status | `--text-label` | 14px | Labels use 600 where specified |

All these screens use `--font-ui: 'DM Sans', sans-serif`. Form text aligns left; invite headings and QR content align center, with the invite field label left-aligned. Button text centers except the landing cards, which retain left-aligned labels. Headings use line-height 1.2. Back has a 44px minimum hit area and a 20px arrow aligned with its text.

Icons come from `lucide-react`: `MessageCircle` for the brand, `Plus` for create, and `Users` for join. Action icons render at 18px inside 26px containers. The brand icon renders at 22px.

## Interactions

1. **Create a chat** navigates to `/chat/create`, a dedicated group naming page. Names accept Unicode letters, numbers, symbols, and emoji, with a 60-code-point limit matching the database. After naming the group, the creator chooses a nickname (up to 32 Unicode code points, including spaces and emoji). Creating a room saves that nickname, then shows an invite screen with a locally generated QR code and a copyable invite URL. Both encode the same membership token. **Enter chat** navigates to `/chat?room=...`. Invite loading can be retried without creating another room. On localhost, other devices need a reachable network or deployed URL to join.
2. **Join a chat** opens a native modal dialog with an invite URL input and submit button.
3. A valid HTTP or HTTPS invite contains both `room` and `invite` in its URL fragment. It navigates to `/chat/join#room=...&invite=...` with values encoded using `URLSearchParams`.
4. Invalid invitation details show: `Enter a valid chat invite link.` The input also uses native required and URL validation.
5. The close control or Escape dismisses the native dialog. Reopening clears the displayed error.
6. Legacy links arriving at `/` with a hash or a `room` query parameter redirect to `/chat`, preserving the query and fragment.

Chat creation and membership require configured Supabase credentials. The landing page itself can render without them.

## Feedback and accessibility

- Landing actions lift 4px on hover, with 200ms transitions and subtle shadows.
- Keyboard focus uses a visible outline; the invite input has its own teal focus ring.
- The dialog has a title association, labeled URL input, and an announced error linked to the input.
- Reduced-motion preferences disable transitions and animation through the global CSS rule.
- The dialog is at most 420px wide, with 32px padding and a 22px corner radius. Its backdrop blurs by 8px.

## Source map

| File | Responsibility |
| --- | --- |
| [`../src/app/page.tsx`](../src/app/page.tsx) | Renders the landing component |
| [`../src/components/landing.tsx`](../src/components/landing.tsx) | Branding, action layout, and legacy-link redirect |
| [`../src/components/join-chat.tsx`](../src/components/join-chat.tsx) | Join dialog, form state, and submission |
| [`../src/lib/invites.ts`](../src/lib/invites.ts) | Shared invite parsing and destination generation |
| [`../src/app/globals.css`](../src/app/globals.css) | Landing styles follow the `Landing styles` comment; shared resets and typography precede them |
| [`../src/app/chat/page.tsx`](../src/app/chat/page.tsx) | Destination chat route |
| [`../src/hooks/use-chat.ts`](../src/hooks/use-chat.ts) | Existing chat behavior and creation flow |
| [`../tests/frontend.test.ts`](../tests/frontend.test.ts) | Invite and message synchronization checks |

## Maintaining the design

Keep layout, form behavior, and invitation utilities separate. Change shared accent values through the existing CSS properties, and update this reference alongside visual changes. The existing chat interface has separate styling; this document describes the landing page and its join dialog only.

Run `npm run dev` to preview. Use `npm run typecheck` and `npm test` for code verification; visually inspect desktop and mobile layouts after styling changes.

## Joining through an invitation

Both QR codes and invite links open `/chat/join`, a dedicated nickname page. The visitor enters a nickname, then **Join chat** validates membership through Supabase and navigates to `/chat?room=...`. Failed joins stay on the nickname page with an error. Existing `/chat#...` and root invitations redirect to the nickname page.
