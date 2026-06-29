/// <reference path="../pb_data/types.d.ts" />

onRecordCreateRequest((e) => {
  const limits = require(`${__hooks}/plan_limits_lib.js`)
  if (limits.hasSuperuserAuth(e)) return e.next()
  limits.enforceSiteCreateLimit(e)
  e.next()
}, 'sites')

onRecordUpdateRequest((e) => {
  const limits = require(`${__hooks}/plan_limits_lib.js`)
  if (limits.hasSuperuserAuth(e)) return e.next()
  limits.enforceSiteUpdateLimits(e)
  e.next()
}, 'sites')

onRecordCreateRequest((e) => {
  const limits = require(`${__hooks}/plan_limits_lib.js`)
  if (limits.hasSuperuserAuth(e)) return e.next()
  limits.enforceUserCreateLimit(e)
  e.next()
}, 'users')

onRecordCreateRequest((e) => {
  const limits = require(`${__hooks}/plan_limits_lib.js`)
  if (limits.hasSuperuserAuth(e)) return e.next()
  limits.enforcePolicyCreateLimit(e)
  e.next()
}, 'policies')

onRecordUpdateRequest((e) => {
  const limits = require(`${__hooks}/plan_limits_lib.js`)
  if (limits.hasSuperuserAuth(e)) return e.next()
  limits.enforceOrganizationUpdateLock(e)
  e.next()
}, 'organizations')
