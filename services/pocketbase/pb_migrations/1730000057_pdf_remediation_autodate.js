/// <reference path="../pb_data/types.d.ts" />

/** Client sort=-created was 400 without autodate fields (same issue as policies). */
migrate((app) => {
  try {
    const remediations = app.findCollectionByNameOrId('pdf_remediations')
    if (!remediations.fields.getByName('created')) {
      remediations.fields.add(new AutodateField({
        name: 'created',
        onCreate: true,
        onUpdate: false
      }))
    }
    if (!remediations.fields.getByName('updated')) {
      remediations.fields.add(new AutodateField({
        name: 'updated',
        onCreate: true,
        onUpdate: true
      }))
    }
    app.save(remediations)
  } catch (_) {}

  try {
    const queue = app.findCollectionByNameOrId('pdf_remediation_queue')
    if (!queue.fields.getByName('created')) {
      queue.fields.add(new AutodateField({
        name: 'created',
        onCreate: true,
        onUpdate: false
      }))
    }
    if (!queue.fields.getByName('updated')) {
      queue.fields.add(new AutodateField({
        name: 'updated',
        onCreate: true,
        onUpdate: true
      }))
    }
    app.save(queue)
  } catch (_) {}
}, (app) => {
  try {
    const remediations = app.findCollectionByNameOrId('pdf_remediations')
    remediations.fields.removeByName('created')
    remediations.fields.removeByName('updated')
    app.save(remediations)
  } catch (_) {}
  try {
    const queue = app.findCollectionByNameOrId('pdf_remediation_queue')
    queue.fields.removeByName('created')
    queue.fields.removeByName('updated')
    app.save(queue)
  } catch (_) {}
})
