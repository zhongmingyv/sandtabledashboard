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
    if (!/^\d+$/.test(String(it.edit)) || Number(it.edit) <= 0) {
      ElMessage.error(`「${it.label}」必须为正整数`)
      return
    }
  }
  try {
    await ElMessageBox.confirm(
      `确认保存 ${changed.length} 项改动？运行时立即生效。调大包上限时注意后端请求体上限也要相应放开。`,
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
          <span>全局配额配置（运行时生效）</span>
          <div>
            <el-button @click="runGc">手动 GC 回收</el-button>
            <el-button type="primary" @click="saveAll">保存改动</el-button>
          </div>
        </div>
      </template>

      <el-table :data="items" border>
        <el-table-column prop="label" label="项目" min-width="180" />
        <el-table-column label="当前值" width="140">
          <template #default="{ row }">{{ row.type === 'bytes' ? fmtBytes(Number(row.value)) : row.value }}</template>
        </el-table-column>
        <el-table-column label="新值" width="200">
          <template #default="{ row }">
            <el-input v-model="row.edit" size="small">
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
          <template #default="{ row }">{{ row.type === 'bytes' ? fmtBytes(Number(row.default)) : row.default }}</template>
        </el-table-column>
        <el-table-column prop="key" label="Key" min-width="200" />
      </el-table>
    </el-card>
  </div>
</template>
