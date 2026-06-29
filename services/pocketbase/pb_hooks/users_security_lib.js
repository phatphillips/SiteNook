/** Goja throws when accessing missing members — must try/catch, not typeof. */
function hasSuperuserAuth(e) {
  try {
    return e.hasSuperuserAuth()
  } catch (_) {
    return false
  }
}

function normalizeOrgId(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value.id) return String(value.id)
  return String(value)
}

function isOrgManager(auth) {
  if (!auth) return false
  return String(auth.get('role') || '') === 'admin'
}

function countOrgUsersByFilter(app, organizationId, filter, excludeUserId) {
  const orgId = normalizeOrgId(organizationId)
  if (!orgId) return 0

  let total = 0
  let page = 1
  const perPage = 200

  while (true) {
    const result = app.findRecordsByFilter(
      'users',
      `organization = {:org} && (${filter})`,
      '',
      perPage,
      (page - 1) * perPage,
      { org: orgId }
    )
    if (!result.length) break

    for (const record of result) {
      if (excludeUserId && record.id === excludeUserId) continue
      total += 1
    }

    if (result.length < perPage) break
    page += 1
  }

  return total
}

function countOrgAdmins(app, organizationId, excludeUserId) {
  return countOrgUsersByFilter(app, organizationId, 'role = "admin"', excludeUserId)
}

function countBillingContacts(app, organizationId, excludeUserId) {
  return countOrgUsersByFilter(app, organizationId, 'is_billing_contact = true', excludeUserId)
}

function teamActivityCollectionExists(app) {
  try {
    app.findCollectionByNameOrId('team_activity_log')
    return true
  } catch {
    return false
  }
}

function writeTeamActivity(app, payload) {
  if (!teamActivityCollectionExists(app)) return

  const collection = app.findCollectionByNameOrId('team_activity_log')
  const record = new Record(collection)
  record.set('organization', normalizeOrgId(payload.organization))
  if (payload.actor) record.set('actor', payload.actor)
  if (payload.target) record.set('target', payload.target)
  record.set('action', payload.action)
  if (payload.details != null) {
    record.set('details', payload.details)
  }
  app.save(record)
}

function rejectInvalidRole(role) {
  if (role !== 'admin' && role !== 'viewer') {
    throw new BadRequestError('Role must be admin or viewer.')
  }
}

function ensureRoleChangeAllowed(app, record, original, auth, hasSuperuser) {
  const newRole = String(record.get('role') || '')
  const oldRole = String(original.get('role') || '')
  if (newRole === oldRole) return

  if (auth && auth.id === record.id) {
    throw new BadRequestError('You cannot change your own role.')
  }

  if (!isOrgManager(auth) && !hasSuperuser) {
    throw new BadRequestError('Only organization admins can change user roles.')
  }

  rejectInvalidRole(newRole)

  if (oldRole === 'admin' && newRole !== 'admin') {
    const orgId = normalizeOrgId(record.get('organization'))
    if (countOrgAdmins(app, orgId, record.id) === 0) {
      throw new BadRequestError('Organization must have at least one Admin.')
    }

    const wasBillingContact = Boolean(original.get('is_billing_contact'))
    if (wasBillingContact && countBillingContacts(app, orgId, record.id) === 0) {
      throw new BadRequestError(
        'Organization must have at least one billing contact — assign another admin as billing contact first.'
      )
    }
  }
}

function ensureBillingContactRules(app, record, original) {
  const newRole = String(record.get('role') || '')
  const oldRole = String(original.get('role') || '')
  const newBilling = Boolean(record.get('is_billing_contact'))
  const oldBilling = Boolean(original.get('is_billing_contact'))
  const orgId = normalizeOrgId(record.get('organization'))

  if (newRole !== 'admin' && newBilling) {
    throw new BadRequestError('Only admins can be billing contacts.')
  }

  if (oldRole === 'admin' && newRole !== 'admin' && oldBilling && !newBilling) {
    if (countBillingContacts(app, orgId, record.id) === 0) {
      throw new BadRequestError(
        'Organization must have at least one billing contact — assign another admin as billing contact first.'
      )
    }
  }

  if (oldBilling && !newBilling) {
    if (countBillingContacts(app, orgId, record.id) === 0) {
      throw new BadRequestError(
        'Organization must have at least one billing contact — assign another admin as billing contact first.'
      )
    }
  }
}

function applyBillingAutoClearOnDemotion(record, original) {
  const newRole = String(record.get('role') || '')
  const oldRole = String(original.get('role') || '')
  if (oldRole === 'admin' && newRole !== 'admin' && Boolean(original.get('is_billing_contact'))) {
    record.set('is_billing_contact', false)
  }
}

function ensureDeleteAllowed(app, record, auth, hasSuperuser) {
  if (!isOrgManager(auth) && !hasSuperuser) {
    throw new BadRequestError('Only organization admins can manage team members.')
  }

  if (auth && auth.id === record.id) {
    throw new BadRequestError('You cannot remove your own account.')
  }

  const orgId = normalizeOrgId(record.get('organization'))
  if (String(record.get('role') || '') === 'admin') {
    if (countOrgAdmins(app, orgId, record.id) === 0) {
      throw new BadRequestError('Organization must have at least one Admin.')
    }
  }

  if (Boolean(record.get('is_billing_contact'))) {
    if (countBillingContacts(app, orgId, record.id) === 0) {
      throw new BadRequestError(
        'Organization must have at least one billing contact — assign another admin as billing contact first.'
      )
    }
  }
}

function logUserUpdateActivity(e) {
  if (hasSuperuserAuth(e)) return

  const record = e.record
  const original = record.original()
  const orgId = normalizeOrgId(record.get('organization'))
  const actorId = e.auth ? e.auth.id : ''
  if (!actorId) return

  const oldRole = String(original.get('role') || '')
  const newRole = String(record.get('role') || '')
  if (oldRole !== newRole) {
    writeTeamActivity(e.app, {
      organization: orgId,
      actor: actorId,
      target: record.id,
      action: 'role_changed',
      details: { from: oldRole, to: newRole }
    })
  }

  const oldBilling = Boolean(original.get('is_billing_contact'))
  const newBilling = Boolean(record.get('is_billing_contact'))
  if (oldBilling !== newBilling) {
    writeTeamActivity(e.app, {
      organization: orgId,
      actor: actorId,
      target: record.id,
      action: newBilling ? 'billing_contact_added' : 'billing_contact_removed',
      details: null
    })
  }
}

module.exports = {
  hasSuperuserAuth,
  rejectInvalidRole,
  ensureRoleChangeAllowed,
  ensureBillingContactRules,
  applyBillingAutoClearOnDemotion,
  ensureDeleteAllowed,
  writeTeamActivity,
  logUserUpdateActivity,
  isOrgManager
}
