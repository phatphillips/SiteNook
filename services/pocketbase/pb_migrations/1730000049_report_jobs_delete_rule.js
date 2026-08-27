/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const reportJobs = app.findCollectionByNameOrId('report_jobs')
  reportJobs.deleteRule = 'org = @request.auth.organization'
  app.save(reportJobs)
}, (app) => {
  const reportJobs = app.findCollectionByNameOrId('report_jobs')
  reportJobs.deleteRule = ''
  app.save(reportJobs)
})
