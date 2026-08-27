/// <reference path="../pb_data/types.d.ts" />

/** Add created/updated on policy_matches so clients can sort by -created. */
migrate((app) => {
  const policyMatches = app.findCollectionByNameOrId('policy_matches')
  if (!policyMatches.fields.getByName('created')) {
    policyMatches.fields.add(new AutodateField({
      name: 'created',
      onCreate: true,
      onUpdate: false
    }))
  }
  if (!policyMatches.fields.getByName('updated')) {
    policyMatches.fields.add(new AutodateField({
      name: 'updated',
      onCreate: true,
      onUpdate: true
    }))
  }
  app.save(policyMatches)
}, (app) => {
  try {
    const policyMatches = app.findCollectionByNameOrId('policy_matches')
    policyMatches.fields.removeByName('created')
    policyMatches.fields.removeByName('updated')
    app.save(policyMatches)
  } catch (_) {}
})
