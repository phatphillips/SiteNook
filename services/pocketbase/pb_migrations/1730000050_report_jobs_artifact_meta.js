/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const reportJobs = app.findCollectionByNameOrId('report_jobs')
  if (!reportJobs.fields.getByName('artifact_size_bytes')) {
    reportJobs.fields.add(new NumberField({
      name: 'artifact_size_bytes',
      min: 0
    }))
  }
  if (!reportJobs.fields.getByName('artifact_page_count')) {
    reportJobs.fields.add(new NumberField({
      name: 'artifact_page_count',
      min: 0
    }))
  }
  app.save(reportJobs)
}, (app) => {
  try {
    const reportJobs = app.findCollectionByNameOrId('report_jobs')
    reportJobs.fields.removeByName('artifact_size_bytes')
    reportJobs.fields.removeByName('artifact_page_count')
    app.save(reportJobs)
  } catch (_) {}
})
