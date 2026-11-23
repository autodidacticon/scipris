# Design

## Context

The search form uses a native search input for validation, keyboard editing, and submission.

## Goals / Non-Goals

**Goals:** Add live syntax cues without interfering with the input, including on narrow screens.

**Non-Goals:** Validate Boolean grammar or change the CORE query parser or API contract.

## Decisions

- Draw colored marks behind the native text with an accessibility-hidden, non-interactive overlay. Keep editing, focus, and the visible query in the native input.
- Pair delimiter tokens after lexing quoted phrases and escapes. Shade the entire matched range, including spaces and literals. Cycle through soft mint, peach, and blue by nesting depth. Sibling groups share a color and unpaired delimiters use mint. Keep the group color visible beneath the lavender operator highlight.
- Render the live mirror and every syntax example with the same Angular component and styles. Keep the explanatory examples readable to assistive technology.
- Use the same tokens for highlighting and request normalization. Translate aliases to uppercase CORE operators, inserting separators where tokens touch. Use the normalized query for both list and chart requests.
- Clip the marks to the input and mirror its horizontal scroll offset. In forced-colors mode, let the native input supply readable text without the decorative layer.

## Risks / Trade-offs

- Text and highlights can drift if their typography or scrolling diverge. Check long queries at mobile and desktop widths in a real browser.
