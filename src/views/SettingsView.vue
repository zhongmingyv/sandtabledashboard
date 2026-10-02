<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api/admin'
import { fmtBytes } from '../utils/format'

const loading = ref(false)
const items = ref([])

async function load() {
  loading.value = true
  try {
    const res = await api.settings()
    items.value = res.items.map((x) => ({ ...x, edit: x.value }))
  } finally {
    loading.value = false
  }
}

function preview(item) {
  if (item.type === 'bool') return item.edit === '1' ? '开' : '关'
  if (item.type === 'bytes') return fmtBytes(Number(item.edit))
  return item.edit + (item.unit && item.unit !== '字节' ? ' ' + item.unit : '')
}

async function saveAll() {
  const changed = items.value.filter((x) => String(x.edit) !== String(x.value))
  if (!changed.length) {
    ElMessage.info('没有改动')
    return
  }
  for (const it of changed) {
    if (it.type === 'bool') continue // 开关项由 el-switch 产出 '0'/'1'，不吃「必须为正整数」这条
    // 版本型:空 = 不限,否则是整数版本号(Maker 每发一版 +1);名单型:逗号分隔的版本号(空 = 清空名单)
    const isVersion = (v) => /^[1-9]\d*$/.test(v)
    if (it.type === 'version') {
      if (String(it.edit).trim() !== '' && !isVersion(String(it.edit).trim())) {
        ElMessage.error(`「${it.label}」须为版本号（正整数，如 12），或留空表示不限`)
        return
      }
      continue
    }
    if (it.type === 'versionList') {
      const parts = String(it.edit).split(',').map((x) => x.trim()).filter((x) => x)
      if (!parts.every(isVersion)) {
        ElMessage.error(`「${it.label}」须为逗号分隔的版本号（如 11, 12）`)
        return
      }
      continue
    }
    if (!/^\d+$/.test(String(it.edit)) || Number(it.edit) <= 0) {
      ElMessage.error(`「${it.label}」必须为正整数`)
      return
    }
  }
  // 旧版本先释放桌、再删包：前一个天数必须比后一个小（服务器也查一遍）
  const days = (key) => Number((items.value.find((x) => x.key === key) || {}).edit)
  if (days('revision.tableReleaseDays') >= days('revision.keepDays')) {
    ElMessage.error('「旧版本几天后释放还没打完的桌」必须小于「旧版本几天后删除」')
    return
  }
  if (days('table.botWorkMultiple') > days('table.maxBotWorkMultiple')) {
    ElMessage.error('「开桌默认 bot 倍数」不能大于「bot 倍数上限」')
    return
  }
  const minutes = ['table.idleMinutes', 'table.offlineMinutes']
  if (minutes.some((k) => days(k) < 1 || days(k) > 60)) {
    ElMessage.error('开桌默认的两个时限要在 1 到 60 分钟之间')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认保存 ${changed.length} 项改动？运行时立即生效。`,
      '保存配置',
      { type: 'warning' },
    )
  } catch {
    return
  }
  const payload = Object.fromEntries(changed.map((x) => [x.key, String(x.edit)]))
  const res = await api.saveSettings(payload)
  items.value = res.items.map((x) => ({ ...x, edit: x.value }))
  ElMessage.success('已保存')
}

async function runGc() {
  try {
    await ElMessageBox.confirm('手动跑一轮 blob 回收（宽限期 0，立即回收孤儿）？', 'blob GC', { type: 'warning' })
  } catch {
    return
  }
  const res = await api.runBlobGc()
  ElMessage.success(`回收完成：删引用 ${res.refsRemoved}，删 blob ${res.blobsDeleted}，删文件 ${res.filesDeleted}`)
}
onMounted(load)
</script>

<template>
  <div v-loading="loading">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>全局配置（运行时生效）</span>
          <div>
            <el-button @click="runGc">手动 GC 回收</el-button>
            <el-button type="primary" @click="saveAll">保存改动</el-button>
          </div>
        </div>
      </template>

      <el-table :data="items" border>
        <el-table-column prop="label" label="项目" min-width="180" />
        <el-table-column label="当前值" width="140">
          <template #default="{ row }">
            <span v-if="row.type === 'bool'">{{ row.value === '1' ? '开' : '关' }}</span>
            <span v-else>{{ row.type === 'bytes' ? fmtBytes(Number(row.value)) : row.value }}</span>
          </template>
        </el-table-column>
        <el-table-column label="新值" width="200">
          <template #default="{ row }">
            <el-switch
              v-if="row.type === 'bool'"
              v-model="row.edit"
              active-value="1"
              inactive-value="0"
              :active-text="row.key === 'campaign.autoApprove' ? '自动' : '开'"
              :inactive-text="row.key === 'campaign.autoApprove' ? '人工' : '关'"
            />
            <el-input v-else v-model="row.edit" size="small">
              <template v-if="row.unit" #append>{{ row.unit }}</template>
            </el-input>
          </template>
        </el-table-column>
        <el-table-column label="预览" width="140">
          <template #default="{ row }">
            <span :style="{ color: String(row.edit) !== String(row.value) ? '#e6a23c' : '#909399' }">
              {{ preview(row) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="默认" width="120">
          <template #default="{ row }">
            <span v-if="row.type === 'bool'">{{ row.default === '1' ? '开' : '关' }}</span>
            <span v-else>{{ row.type === 'bytes' ? fmtBytes(Number(row.default)) : row.default }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="key" label="Key" min-width="200" />
      </el-table>
    </el-card>
  </div>
</template>
