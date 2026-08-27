/// <reference path="../pb_data/types.d.ts" />

/**
 * Policies gain a kind:
 * - flag_content (default): existing keyword/regex/html_attribute → policy_matches
 * - exclude_from_accessibility: CSS selectors excluded from axe at scan time
 *
 * Also adds css_selector to rule_type for exclude policies.
 */
migrate((app) => {
  const policies = app.findCollectionByNameOrId('policies')

  const ruleType = policies.fields.getByName('rule_type')
  if (ruleType && !ruleType.values.includes('css_selector')) {
    ruleType.values = [...ruleType.values, 'css_selector']
  }

  if (!policies.fields.getByName('kind')) {
    policies.fields.add(new SelectField({
      name: 'kind',
      values: ['flag_content', 'exclude_from_accessibility'],
      maxSelect: 1
    }))
  }

  app.save(policies)

  const rows = app.findAllRecords('policies')
  for (const row of rows) {
    const kind = String(row.get('kind') || '').trim()
    if (kind) continue
    row.set('kind', 'flag_content')
    app.save(row)
  }

  const kindField = policies.fields.getByName('kind')
  if (kindField) {
    kindField.required = true
    app.save(policies)
  }
}, (app) => {
  try {
    const policies = app.findCollectionByNameOrId('policies')
    const ruleType = policies.fields.getByName('rule_type')
    if (ruleType) {
      ruleType.values = ruleType.values.filter(v => v !== 'css_selector')
    }
    policies.fields.removeByName('kind')
    app.save(policies)
  } catch (_) {}
})
