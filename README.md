# Study Tracker

A single-page tracker for Semester VII coursework and placement preparation.
No build step, no dependencies, no backend — open `index.html` and it runs.

Everything is stored in the browser's `localStorage`. Nothing is sent anywhere.

---

## Running it

Open `index.html` directly, or serve the folder if you prefer a real origin:

```bash
python -m http.server 8770
```

Then visit <http://localhost:8770>.

---

## What's in it

### Semester view

A bento dashboard over the three subjects (Generative AI, Cloud Computing,
AI Ethics):

- **Progress index** — one weighted percentage, with in-progress counted as half.
  Hover a legend key to isolate those items across the whole page.
- **Every item** — theory modules `M1`–`M5` plus `IA-1`, lab experiments `E1`–`E8`
  plus `CA1`/`CA2`, and the two major-project parts. Click to cycle status,
  arrow keys to move, space to cycle.
- **Detail panel** — per-item notes and scores.
- **Activity** — a twelve-week heatmap and a day streak.
- **Backup** — export and import a JSON snapshot, or reset the current profile.

### Placement view

Preparation for DSA and SQL interview rounds, in six sections:

| Section | What it holds |
| --- | --- |
| Overview | Readiness score, today's drill, weakest Tier 1 topics, daily targets |
| DSA | 24 topics / 248 problems, tiered, each with signals, pitfalls and a checklist |
| SQL | 18 topics / 102 items, covering query craft and the DBMS viva |
| Flashcards | 184 cards across 8 decks on a spaced-repetition schedule |
| Cheatsheets | 7 reference sheets including 13 code templates |
| Log | Practice journal, unaided-rate tracking, and a LeetCode number list |

The readiness score weights DSA coverage 35%, SQL 25%, flashcard recall 25%,
and consistency 15%. Coverage is tier-weighted, so Tier 1 topics count for more.

Flashcards use an SM-2-style scheduler with four grades. Each grade shows the
interval it would set before you pick it.

---

## Profiles

Two profiles share the app: **Amigo** and **Spidey**. The chip in the top-right
switches between them.

Every storage key is namespaced per profile, so semester progress, activity
streaks, flashcard schedules and practice logs stay completely separate. Theme
and the current view are shared, since those are preferences of the browser
rather than of the person.

> **This is a profile switcher, not a login.** There is no server, so there is
> nothing to check a password against and nowhere to hide the data — anyone at
> this browser can switch profiles and read either set. For genuine separation,
> use different browsers or devices; `localStorage` is already per-browser.

---

## Files

| File | Role |
| --- | --- |
| `index.html` | Markup and script order |
| `style.css` | Design tokens and the semester view |
| `app.js` | Semester state, rendering, backup, dock, theme |
| `profiles.js` / `profiles.css` | Profile namespacing and the switcher chip |
| `sync.js` / `sync.css` | Optional GitHub Gist sync and its settings sheet |
| `placement.js` / `placement.css` | Placement view logic and styling |
| `placement-data.js` | DSA and SQL topic banks |
| `placement-cards.js` | Flashcard decks |
| `placement-sheets.js` | Reference sheets and code templates |

Content lives in the three `placement-*` data files and is plain data — add a
topic, problem or card by editing the array, no code changes needed.

---

## Backups

Export writes `study-tracker-<profile>-<date>.json`, containing the semester
data, the activity heatmap and the full placement state. Import restores into
whichever profile is currently active. Reset clears only the active profile.

Export before clearing site data — `localStorage` goes with it.

---

## Sync across devices (optional)

**Backup → Sync** keeps a profile in a secret GitHub Gist, so the same data
opens on every device.

1. Create a token at
   [github.com/settings/tokens/new?scopes=gist](https://github.com/settings/tokens/new?scopes=gist)
   with the **`gist` scope ticked and nothing else**.
2. Open the tracker, click **Sync**, paste the token, hit **Connect**.
3. On any other device, paste the same token. It finds the existing gist for
   that profile and pulls it down — it does not create a second one.

Saves are pushed automatically about five seconds after you stop editing, and
again when you leave the tab. The dot on the profile chip shows the state:
grey off, amber unsaved, blue syncing, green synced, red needs attention.

**Conflicts are never resolved silently.** Before every push the tracker checks
whether the gist changed elsewhere. If it did, syncing pauses and you pick which
copy to keep — nothing is overwritten until you choose.

Each profile connects separately, so Amigo and Spidey use their own tokens and
their own gists.

### What this costs you

- The token is stored in that browser's `localStorage`, in plain text. It is
  sent to `api.github.com` and nowhere else, and never enters this repo — but
  anyone with access to the browser can read it. Revoke it on GitHub if a
  machine is lost.
- **Secret gists are unlisted, not private.** Anyone holding the URL can read
  the contents, so keep anything genuinely sensitive out of your notes.
- The `gist` scope cannot touch your repositories.
