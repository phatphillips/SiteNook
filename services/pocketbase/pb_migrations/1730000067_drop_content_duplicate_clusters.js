/// <reference path="../pb_data/types.d.ts" />

/**
 * Remove content duplicate detection: drop content_duplicate_clusters and all rows.
 */
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId('content_duplicate_clusters')
    app.delete(collection)
  } catch (_) {
    // already removed
  }
}, (app) => {
  // Irreversible data removal — no recreate on down.
  void app
})
