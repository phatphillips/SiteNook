/**
 * Email recipients when a scheduled report job completes.
 * Called by the scanner with superuser auth.
 * Requires PocketBase SMTP in Settings → Mail settings.
 */
/// <reference path="../pb_data/types.d.ts" />

routerAdd('POST', '/api/sitenook/notify-report-ready', (c) => {
  const body = $apis.requestInfo(c).data || {}
  const jobId = String(body.jobId || '').trim()
  if (!jobId) {
    return c.json(400, { error: 'jobId is required' })
  }

  let job
  try {
    job = c.app.findRecordById('report_jobs', jobId)
  } catch (_) {
    return c.json(404, { error: 'Report job not found' })
  }

  const mailer = require(`${__hooks}/report_schedule_mailer_lib.js`)
  const sent = mailer.notifyReportReady(c.app, job)
  return c.json(200, { sent })
}, $apis.requireSuperuserAuth())
