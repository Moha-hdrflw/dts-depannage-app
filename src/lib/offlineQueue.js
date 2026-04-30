const KEY = 'dts_offline_queue'

export function addToQueue(item) {
  const queue = getQueue()
  const queueId = Date.now().toString()
  queue.push({ ...item, _queueId: queueId, _savedAt: new Date().toISOString() })
  localStorage.setItem(KEY, JSON.stringify(queue))
  return queueId
}

export function getQueue() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') }
  catch { return [] }
}

export function removeFromQueue(queueId) {
  const queue = getQueue().filter(i => i._queueId !== queueId)
  localStorage.setItem(KEY, JSON.stringify(queue))
}

export function getQueueCount() {
  return getQueue().length
}
