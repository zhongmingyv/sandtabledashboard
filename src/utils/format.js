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

export function fmtDate(s) {
  if (!s) return '-'
  const d = new Date(s)
  if (isNaN(d)) return s
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
