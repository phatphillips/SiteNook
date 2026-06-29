/// <reference path="../pb_data/types.d.ts" />

onRecordCreateRequest((e) => {
  const security = require(`${__hooks}/users_security_lib.js`)

  if (security.hasSuperuserAuth(e)) {
    return e.next()
  }

  security.rejectInvalidRole(String(e.record.get('role') || ''))

  if (!security.isOrgManager(e.auth)) {
    throw new BadRequestError('Only organization admins can add team members.')
  }

  e.next()

  const actorId = e.auth ? e.auth.id : ''
  if (!actorId) return

  security.writeTeamActivity(e.app, {
    organization: e.record.get('organization'),
    actor: actorId,
    target: e.record.id,
    action: 'member_added',
    details: { role: String(e.record.get('role') || '') }
  })
}, 'users')

onRecordUpdateRequest((e) => {
  const security = require(`${__hooks}/users_security_lib.js`)

  if (security.hasSuperuserAuth(e)) {
    return e.next()
  }

  const record = e.record
  const original = record.original()

  const normalizeOrgId = (value) => {
    if (value == null || value === '') return ''
    if (typeof value === 'string') return value
    if (typeof value === 'object' && value.id) return String(value.id)
    return String(value)
  }

  const newOrg = normalizeOrgId(record.get('organization'))
  const oldOrg = normalizeOrgId(original.get('organization'))
  if (newOrg !== oldOrg) {
    throw new BadRequestError('Organization cannot be changed.')
  }

  security.applyBillingAutoClearOnDemotion(record, original)
  security.ensureRoleChangeAllowed(e.app, record, original, e.auth, false)
  security.ensureBillingContactRules(e.app, record, original)

  e.next()
  security.logUserUpdateActivity(e)
}, 'users')

onRecordDeleteRequest((e) => {
  const security = require(`${__hooks}/users_security_lib.js`)

  if (security.hasSuperuserAuth(e)) {
    return e.next()
  }

  security.ensureDeleteAllowed(e.app, e.record, e.auth, false)

  const actorId = e.auth ? e.auth.id : ''
  if (actorId) {
    security.writeTeamActivity(e.app, {
      organization: e.record.get('organization'),
      actor: actorId,
      target: e.record.id,
      action: 'member_removed',
      details: {
        role: String(e.record.get('role') || ''),
        targetId: e.record.id,
        targetName: String(e.record.get('name') || ''),
        targetEmail: String(e.record.get('email') || '')
      }
    })
  }

  e.next()
}, 'users')
