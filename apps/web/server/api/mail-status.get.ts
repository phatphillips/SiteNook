import { getPbAdmin } from '../utils/pbAdmin'
import { requirePbUser } from '../utils/requirePbUser'

/** Whether PocketBase SMTP is enabled. Does not return host or credentials. */
export default defineEventHandler(async (event) => {
  await requirePbUser(event)
  const pb = await getPbAdmin(event)
  const settings = await pb.settings.getAll()
  const smtp = settings?.smtp as { enabled?: boolean } | undefined
  return { enabled: Boolean(smtp?.enabled) }
})
