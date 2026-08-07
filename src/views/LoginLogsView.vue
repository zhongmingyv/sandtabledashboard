<script setup>
import { ref, reactive, onMounted } from 'vue'
import { api } from '../api/admin'
import { fmtDate, fmtMinutes } from '../utils/format'
import { PAGE_SIZE } from '../config'
const loading = ref(false), rows = ref([]), total = ref(0)
const query = reactive({ page: 1, q: '' })
async function load() { loading.value = true; try { const r = await api.loginLogs(query); rows.value = r.items; total.value = r.total } finally { loading.value = false } }
onMounted(load)
</script>
<template><div>
  <el-input v-model="query.q" placeholder="账号、IP或机器指纹" clearable style="width:280px" @keyup.enter="query.page=1;load()" />
  <el-button style="margin-left:8px" @click="query.page=1;load()">查询</el-button>
  <el-table :data="rows" v-loading="loading" border style="margin-top:16px">
    <el-table-column prop="createdAt" label="登录时间" width="180"><template #default="{row}">{{ fmtDate(row.createdAt) }}</template></el-table-column>
    <el-table-column prop="email" label="账号" width="220" />
    <el-table-column prop="displayName" label="昵称" width="140" />
    <el-table-column prop="machineFingerprint" label="机器指纹" min-width="260"><template #default="{row}">{{ row.machineFingerprint || '未上报' }}</template></el-table-column>
    <el-table-column prop="clientVersion" label="编辑器版本" width="120"><template #default="{row}">{{ row.clientVersion || '未上报' }}</template></el-table-column>
    <el-table-column prop="ipAddress" label="IP" width="160" />
    <!-- 这一行记的是**上一次**会话用了多久，不是本次；客户端自报，服务端已钳过界 -->
    <el-table-column prop="lastSessionMinutes" label="上次时长" width="120"><template #default="{row}">{{ fmtMinutes(row.lastSessionMinutes) }}</template></el-table-column>
  </el-table>
  <div class="pager"><el-pagination layout="prev, pager, next" :total="total" :page-size="PAGE_SIZE" :current-page="query.page" @current-change="p => { query.page=p; load() }" /></div>
</div></template>
