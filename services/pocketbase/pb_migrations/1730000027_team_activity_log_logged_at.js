/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  let collection
  try {
    collection = app.findCollectionByNameOrId('team_activity_log')
  } catch (_) {
    return
  }

  if (!collection.fields.getByName('logged_at')) {
    collection.fields.add(new AutodateField({
      name: 'logged_at',
      onCreate: true,
      onUpdate: false
    }))
    app.save(collection)
  }

  const records = app.findAllRecords('team_activity_log')
  for (const record of records) {
    if (!record.get('logged_at')) {
      record.setRaw('logged_at', new Date().toISOString())
      app.save(record)
    }
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId('team_activity_log')
    const field = collection.fields.getByName('logged_at')
    if (field) {
      collection.fields.removeByName('logged_at')
      app.save(collection)
    }
  } catch (_) {}
})
