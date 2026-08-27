import { Queue, Worker, type ConnectionOptions } from 'bullmq'
import { Redis } from 'ioredis'
import type PocketBase from 'pocketbase'

const QUEUE_NAME = 'sitenook-scans'

let scanQueue: Queue | null = null
let scanWorker: Worker | null = null
let redisConnection: Redis | null = null

export function isBullMqEnabled(): boolean {
  return process.env.SCANNER_BULLMQ_ENABLED === '1'
    && Boolean(process.env.BULLMQ_REDIS_URL?.trim())
}

function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis(process.env.BULLMQ_REDIS_URL!.trim(), {
      maxRetriesPerRequest: null
    })
  }
  return redisConnection
}

function getScanQueue(): Queue {
  if (!scanQueue) {
    const connection = getRedisConnection() as unknown as ConnectionOptions
    scanQueue = new Queue(QUEUE_NAME, { connection })
  }
  return scanQueue
}

export async function enqueuePendingScansToBullMq(pb: PocketBase): Promise<number> {
  if (!isBullMqEnabled()) return 0

  const pending = await pb.collection('scan_queue').getList(1, 50, {
    filter: "status = 'pending'",
    sort: '-priority,id'
  })

  const queue = getScanQueue()
  let enqueued = 0

  for (const item of pending.items) {
    const priority = Number(item.priority ?? 0)
    try {
      await queue.add(
        'scan',
        { queueId: item.id },
        {
          jobId: item.id,
          priority,
          removeOnComplete: true,
          removeOnFail: 100
        }
      )
      enqueued += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!message.includes('Job') || !message.includes('exists')) {
        console.warn(`BullMQ enqueue failed for queue item ${item.id}:`, err)
      }
    }
  }

  return enqueued
}

export async function startBullMqScanWorker(
  processQueueItem: (queueId: string) => Promise<void>
): Promise<void> {
  if (!isBullMqEnabled() || scanWorker) return

  const connection = getRedisConnection() as unknown as ConnectionOptions
  const concurrency = Math.max(1, Number(process.env.SCANNER_WORKER_CONCURRENCY || 1))

  scanWorker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const queueId = String(job.data?.queueId ?? '')
      if (!queueId) return
      await processQueueItem(queueId)
    },
    { connection, concurrency }
  )

  scanWorker.on('failed', (job, err) => {
    console.error(`BullMQ job ${job?.id} failed:`, err)
  })

  console.log(`BullMQ scan worker started (concurrency=${concurrency})`)
}

export async function closeBullMq(): Promise<void> {
  await scanWorker?.close()
  await scanQueue?.close()
  await redisConnection?.quit()
  scanWorker = null
  scanQueue = null
  redisConnection = null
}
