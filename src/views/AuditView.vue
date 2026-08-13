<script setup>
import { ref, reactive, onMounted } from 'vue'
import { api } from '../api/admin'
import { fmtDate } from '../utils/format'
import { PAGE_SIZE } from '../config'

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const query = reactive({ page: 1 })

// 认不出的动作原样显示，所以这张表不全也不会瞎；下面这些是服务端真会写进流水的。
// campaign.ban 两个地方都会写：后台点封禁，或试玩账号驳回时勾了「硬拦」（Actor 带 reviewer: 前缀）。
const actionLabel = {
  'user.ban': '封禁用户',
  'user.unban': '解封用户',
  'campaign.approved': '收录战役',
  'campaign.rejected': '驳回战役（不曝光）',
  'campaign.ban': '封禁战役',
  'campaign.unban': '解封战役',
  'campaign.delete': '硬删战役',
  'resource.ban': '封禁资源',
  'resource.unban': '解封资源',
  'resource.delete': '硬删资源',
  'blob.ban': '封禁图片',
  'blob.unban': '解封图片',
  'blob.delete': '删除图片',
  'replay.delete': '删除复盘',
  'setting.write': '改配置',
  'admin.password': '改后台密码',
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
