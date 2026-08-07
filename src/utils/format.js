export function fmtBytes(n) {
  n = Number(n) || 0
  if (n < 1024) return n + ' B'
  const units = ['KB', 'MB', 'GB', 'TB']
  let i = -1
  do {
    n /= 1024
    i++
  } while (n >= 1024 && i < units.length - 1)
  return n.toFixed(n < 10 ? 2 : 1) + ' ' + units[i]
}

/** 分钟数 → 「3 小时 12 分」。0 / 缺失 = 没上报（首次启动，或上一笔已报过）。 */
export function fmtMinutes(n) {
  n = Number(n) || 0
  if (n <= 0) return '-'
  if (n < 60) return n + ' 分'
  const h = Math.floor(n / 60), m = n % 60
  return m === 0 ? h + ' 小时' : `${h} 小时 ${m} 分`
}

export function fmtDate(s) {
  if (!s) return '-'
  const d = new Date(s)
  if (isNaN(d)) return s
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
