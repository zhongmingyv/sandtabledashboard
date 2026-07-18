<script setup>
import { ref, reactive, onMounted } from 'vue'
import { api } from '../api/admin'
import { fmtDate } from '../utils/format'
import { PAGE_SIZE } from '../config'

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const query = reactive({ page: 1 })

const actionLabel = {
  'user.ban': '封禁用户',
  'user.gold': '改金币',
  'content.ban': '封禁内容',
  'content.delete': '删除内容',
  'setting.write': '改配置',
}

async function load() {
  loading.value = true
  try {
    const res = await api.audit({ ...query })
    rows.value = res.items
    total.value = res.total
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<template>
  <div>
    <el-table :data="rows" v-loading="loading" border>
      <el-table-column prop="createdAt" label="时间" width="160">
        <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column prop="actor" label="操作者" width="140" />
      <el-table-column label="动作" width="140">
        <template #default="{ row }">
          <el-tag size="small">{{ actionLabel[row.action] || row.action }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="target" label="对象" width="160" />
      <el-table-column prop="detail" label="详情" min-width="240" />
    </el-table>
    <div class="pager">
      <el-pagination layout="prev, pager, next" :total="total" :page-size="PAGE_SIZE" :current-page="query.page" @current-change="(p) => { query.page = p; load() }" />
    </div>
  </div>
</template>
