/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const reportSchedules = app.findCollectionByNameOrId('report_schedules')
  if (!reportSchedules.fields.getByName('created')) {
    reportSchedules.fields.add(new AutodateField({
      name: 'created',
      onCreate: true,
      onUpdate: false
    }))
  }
  if (!reportSchedules.fields.getByName('updated')) {
    reportSchedules.fields.add(new AutodateField({
      name: 'updated',
      onCreate: true,
      onUpdate: true
    }))
  }
  app.save(reportSchedules)

  const reportJobs = app.findCollectionByNameOrId('report_jobs')
  if (!reportJobs.fields.getByName('created')) {
    reportJobs.fields.add(new AutodateField({
      name: 'created',
      onCreate: true,
      onUpdate: false
    }))
  }
  if (!reportJobs.fields.getByName('updated')) {
    reportJobs.fields.add(new AutodateField({
      name: 'updated',
      onCreate: true,
      onUpdate: true
    }))
  }
  app.save(reportJobs)
}, (app) => {
  try {
    const reportSchedules = app.findCollectionByNameOrId('report_schedules')
    reportSchedules.fields.removeByName('created')
    reportSchedules.fields.removeByName('updated')
    app.save(reportSchedules)
  } catch (_) {}

  try {
    const reportJobs = app.findCollectionByNameOrId('report_jobs')
    reportJobs.fields.removeByName('created')
    reportJobs.fields.removeByName('updated')
    app.save(reportJobs)
  } catch (_) {}
})
