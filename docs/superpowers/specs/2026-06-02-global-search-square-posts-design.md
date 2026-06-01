# Global Search Square Posts Design

## Goal

Extend global search so users can find square posts alongside courses, materials, and course posts, then open the matching square post detail page.

## Scope

This change extends the existing `GET /api/search` endpoint and the existing global search page. It does not add a second square-specific search endpoint, change the square feed, or alter the square post detail page.

## Backend

Add a `squarePosts` result collection to `GET /api/search`.

- Return `squarePosts` when `type=all` or `type=squarePosts`.
- Match the trimmed query against `square_posts.title` and `square_posts.description`.
- Join `users` to return the creator nickname.
- Return the fields required by the result card: `id`, `title`, `description`, `category`, `status`, `max_people`, `current_count`, `expires_at`, `created_at`, and `creator_name`.
- Apply the same visibility rule used by the square feed: include posts only when `expires_at > datetime('now')` and `status != 'expired'`.
- Keep visible `open`, `full`, and `closed` posts searchable. The visibility rule is intentionally based on the square feed filter, rather than only returning recruiting posts.
- Order matches by `created_at DESC` and apply the existing per-section result limit.
- Include the `squarePosts` length in the response `total`.

## Frontend

Extend the existing search page in `public/js/pages/auth.js`.

- Add a `squarePosts` tab labeled `广场帖子`.
- Include `squarePosts` results in the `全部` tab response rendering.
- Render a separate square-post section after course posts.
- Each card shows the highlighted title, a highlighted description snippet when present, category, creator name, status, and remaining days.
- Reuse the existing search result card styling and keyword highlighting helpers. No new CSS is required unless implementation reveals a layout issue.
- Update the search input label so users know square posts are included.

## Navigation

Clicking a square-post search result calls:

```js
navigateTo('square-post', post.id)
```

The existing SPA route maps this page to `/explore/square/post/:id`, and the existing square detail renderer loads `/api/square/posts/:id`.

## Error Handling

Global search keeps its current validation and failure behavior:

- Queries shorter than two characters return the existing validation error.
- Search request failures render the existing generic search failure card.
- An empty `squarePosts` collection simply omits the square-post result section.

## Testing

Add focused regression coverage for:

- `type=squarePosts` returns matching visible square posts.
- `type=all` includes square-post matches and counts them in `total`.
- A visible `full` square post remains searchable.
- An expired square post is excluded.
- A non-matching square post is excluded.
- Frontend rendering includes the `squarePosts` tab and navigates square result cards to `square-post`.

## Out Of Scope

- Full-text indexing or ranking changes.
- Pagination changes.
- Searching square comments.
- Changing the square feed visibility policy.
- Refactoring the existing search page into a separate module.
