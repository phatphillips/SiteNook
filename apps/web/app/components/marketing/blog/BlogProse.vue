<template>
  <div class="blog-prose">
    <slot />
  </div>
</template>

<style scoped>
.blog-prose :deep(h2) {
  margin-top: 2.25rem;
  margin-bottom: 0.75rem;
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--ui-text-highlighted);
}

.blog-prose :deep(h3) {
  margin-top: 1.75rem;
  margin-bottom: 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--ui-text-highlighted);
}

.blog-prose :deep(p) {
  margin-top: 1rem;
  margin-bottom: 1rem;
  font-size: 1.0625rem;
  line-height: 1.75;
  color: var(--ui-text);
}

.blog-prose :deep(ul),
.blog-prose :deep(ol) {
  margin: 1rem 0;
  padding-left: 1.25rem;
  color: var(--ui-text);
}

.blog-prose :deep(li) {
  margin: 0.35rem 0;
  line-height: 1.65;
}

.blog-prose :deep(ul) {
  list-style: disc;
}

.blog-prose :deep(ol) {
  list-style: decimal;
}

.blog-prose :deep(a) {
  color: var(--ui-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.blog-prose :deep(img) {
  margin: 1.5rem 0;
  border-radius: 0.75rem;
  border: 1px solid color-mix(in srgb, var(--ui-border) 80%, transparent);
  max-width: 100%;
  height: auto;
}

.blog-prose :deep(blockquote) {
  margin: 1.5rem 0;
  padding-left: 1rem;
  border-left: 3px solid var(--ui-border);
  color: var(--ui-text-muted);
  font-style: italic;
}

.blog-prose :deep(hr) {
  margin: 2.5rem 0;
  border: 0;
  border-top: 1px solid var(--ui-border);
}

.blog-prose :deep(code) {
  font-size: 0.9em;
  padding: 0.1em 0.35em;
  border-radius: 0.25rem;
  background: var(--ui-bg-elevated);
}
</style>
