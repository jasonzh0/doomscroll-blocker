# Chrome Web Store listing copy

Paste these into the Developer Dashboard. Lengths are within Chrome's field limits.

## Title (≤ 45 chars)

```
Doomscroll Blocker — Stop the Infinite Scroll
```

## Summary / short description (≤ 132 chars)

```
Set your own limit on doomscrolling and YouTube Shorts. Cross it and a full-screen reminder tells you to go touch grass.
```

## Detailed description

```
Doomscroll Blocker helps you take back your attention from infinite feeds.

You choose the sites that pull you in. The extension quietly watches how far you scroll — and how many YouTube Shorts you burn through. Cross the line you set, and a full-screen, Iron Man–style heads-up display takes over the page and (gently) tells you to go touch some grass.

HOW IT WORKS
• Add any site to your blocklist — social media, news, video, your call.
• Set your own limits: a scroll distance, and a YouTube Shorts count.
• Go past the limit and a "threshold exceeded" alert fades the page out, then resolves into a calm reminder to step away.

WHY YOU'LL LIKE IT
• You set the rules — no forced timers, no nagging.
• Works on YouTube Shorts, not just normal pages.
• Settings apply instantly to tabs you already have open.
• A genuinely good-looking HUD instead of a boring block page.

PRIVATE BY DESIGN
• One permission only: storage, to save your list and limits.
• No accounts, no tracking, no analytics, no servers.
• No remote code — all scripts and fonts ship inside the extension.
• Your blocklist never leaves your browser.

Stop the spiral. Reclaim your attention. Go touch grass.
```

---

# Privacy practices tab

## Single purpose

```
Help users curb doomscrolling: on sites the user chooses to block, warn them with a full-screen reminder once they scroll past a limit they set (or watch too many YouTube Shorts), nudging them to step away.
```

## Permission justifications

**storage**

```
Stores the user's blocklist and their scroll-distance and YouTube-Shorts limits in chrome.storage.local so their settings persist between sessions. This data stays on the device and is never transmitted.
```

**Host permission (`<all_urls>` content script)**

```
The blocklist is entirely user-defined, so the content script must be able to run on whichever sites the user adds. It only activates its scroll/Shorts tracking and the warning overlay on sites the user has explicitly added to their list; on every other site it does nothing. It reads only the page's own URL and scroll position, locally — no page content is collected, stored, or transmitted.
```

## Are you using remote code?

```
No. All JavaScript, fonts, and assets are bundled inside the extension package; nothing is loaded from a remote URL or evaluated at runtime.
```
