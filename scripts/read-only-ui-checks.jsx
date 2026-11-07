// Run only on the disposable VPS. The bootstrap supplies jsdom and a same-origin
// Cookie/Origin bridge; the first checks use the live HTTPS management API.
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/App';
import fs from 'node:fs';

const results = [];
function check(name, condition) { assert.ok(condition, name); results.push(name); }
const text = () => document.body.textContent;
const buttons = () => [...document.querySelectorAll('button')];
const button = label => buttons().find(element => element.textContent.trim() === label || element.getAttribute('aria-label') === label);
async function click(element) { assert.ok(element, 'target button exists'); await act(async () => element.click()); }
async function wait(predicate, label) {
  const deadline = Date.now() + 35000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out: ' + label);
    await act(async () => new Promise(resolve => setTimeout(resolve, 80)));
  }
}
async function input(element, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value);
    element.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
}
async function submit(form) { await act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))); }
async function select(label, value) {
  await click((document.querySelector("dialog[open]") ?? document).querySelector(`[role="combobox"][aria-label="${label}"]`));
  const option = [...document.querySelectorAll('[role="option"]')].find(item => item.textContent === value);
  await click(option);
}
const root = createRoot(document.getElementById('root'));
await act(async () => root.render(<App/>));
await wait(() => document.querySelector('#admin-token') && !document.querySelector('#admin-token').disabled, 'token field ready');
check('Production entry requires admin login; no preview fixtures', !text().includes('dubi-development') && !text().includes('正常运行'));
const token = JSON.parse(fs.readFileSync('/var/tmp/dubi-http-demo-20261106/admin.json', 'utf8')).token;
await input(document.querySelector('#admin-token'), token);
await submit(document.querySelector('form'));
await wait(() => text().includes('文件系统总容量'), 'live cluster overview');
check('Live cluster data rendered', text().includes('3个节点'));
check('Raw login token is absent from DOM and browser storage', !document.documentElement.innerHTML.includes(token) && localStorage.length === 0 && sessionStorage.length === 0);
check('Observation coverage shown', text().includes('容量统计 3 / 3 节点'));
await click(button('区域与节点'));
await wait(() => text().includes('本页 3 条'), 'live node list');
await select('筛选区域', globalThis.liveNode.region_id);
await wait(() => !text().includes('正在读取') && document.querySelector('tbody tr'), 'regional nodes');
check('Regional node endpoint connected', [...globalThis.livePaths].some(path => /\/regions\/.+\/nodes$/.test(path)));
await select('筛选区域', '全部区域');
await wait(() => text().includes('本页 3 条') && !text().includes('正在读取'), 'all nodes restored');
check('Node status is immediately before actions', [...document.querySelectorAll('thead th')].slice(-2).map(item => item.textContent).join('|') === '状态|操作');
check('Node list uses API cursor pagination', button('下一页').disabled && button('上一页').disabled);
await click(button('详情'));
await wait(() => text().includes('单次放置可写额度'), 'live node detail');
check('Node details loaded', !!document.querySelector('dialog[open]'));
await click(button('Volume'));
await wait(() => document.querySelector('.volume-choice'), 'live volumes');
await click(document.querySelector('.volume-choice'));
await wait(() => text().includes('登记状态'), 'live volume detail');
check('Volume list and detail both connected', text().includes('写入隔离'));
await select('每页条数', '每页 50 条');
check('Select works within modal top layer', !!document.querySelector('dialog[open]'));
await click(button('维护状态'));
await wait(() => document.querySelector('.activity-list'), 'live node maintenance');
check('Node maintenance phases render without invented percent', text().includes('最近进展'));
await click(button('关闭节点详情'));
await wait(() => !document.querySelector('dialog[open]'), 'node drawer closes after animation');
await click(button('存储与容量'));
await wait(() => text().includes('本页 3 条') && document.querySelector('tbody tr'), 'storage page');
const headers = () => [...document.querySelectorAll('thead th')].map(item => item.textContent.trim());
check('Storage is a Volume list with status before actions', headers().join('|') === 'Volume / 路径|节点 / 区域|容量 / 使用|写入隔离|状态|操作');
check('Storage summary contains capacities, not member/region counts', text().includes('集群文件系统总容量') && text().includes('可用容量') && !text().includes('节点总数'));
check('Node filter waits for a region and status defaults to all', document.querySelector('[aria-label="筛选 Volume 所属节点"]').disabled && document.querySelector('[aria-label="筛选 Volume 状态"]').textContent.includes('全部状态'));
check('Sidebar has no console caption row', !document.querySelector('.sidebar-context'));
await select('筛选 Volume 状态', '不可访问');
await wait(() => text().includes('未找到匹配的 Volume') && !text().includes('正在读取'), 'live volume health filter');
check('Status filters actual volumes on server', document.querySelectorAll('tbody tr').length === 0);
await select('筛选 Volume 状态', '全部状态');
await wait(() => text().includes('本页 3 条'), 'restore all volume statuses');
await select('筛选 Volume 所属区域', globalThis.liveNode.region_id);
await wait(() => !document.querySelector('[aria-label="筛选 Volume 所属节点"]').disabled, 'regional node choices');
await select('筛选 Volume 所属节点', globalThis.liveNode.name || globalThis.liveNode.node_id);
await wait(() => text().includes('本页 1 条'), 'selected node volume list');
check('Region and node filters combine on server', document.querySelectorAll('tbody tr').length === 1);
await select('筛选 Volume 所属区域', '全部区域');
await wait(() => text().includes('本页 3 条'), 'region reset clears node');
check('Clearing region clears and disables node filter', document.querySelector('[aria-label="筛选 Volume 所属节点"]').disabled);
await click(button('详情'));
await wait(() => text().includes('使用状态') && document.querySelector('dialog[open]'), 'independent volume detail');
check('Volume detail is an independent drawer', !!document.querySelector('#volume-title') && !document.querySelector('[role="tablist"]') && text().includes('/var/'));
await click(button('关闭 Volume 详情'));
await wait(() => !document.querySelector('dialog[open]'), 'volume drawer closes');
const liveVolume = globalThis.liveVolume;
check('Live volume endpoint supplies owner and volume identity', !!liveVolume?.node_id && !!liveVolume?.volume_id);
let volumeFailure = false;
globalThis.interceptor = async url => {
  if (url.pathname === '/api/v1/admin/regions/' + encodeURIComponent(globalThis.liveNode.region_id) + '/nodes') {
    const offset = Number(url.searchParams.get('cursor') || 0);
    const all = Array.from({ length: 53 }, (_, index) => ({ ...globalThis.liveNode, node_id: 'option-' + index, name: 'option-' + index }));
    return Response.json({ data: { items: all.slice(offset, offset + 50), next_cursor: offset === 0 ? '50' : '' }, meta: { request_id: 'node-options', generated_unix: 1, complete: true } });
  }
  if (url.pathname !== '/api/v1/admin/volumes') return;
  globalThis.lastVolumeFilter = Object.fromEntries(url.searchParams);
  if (volumeFailure) return Response.json({ message: 'Volume query unavailable' }, { status: 503 });
  const size = Number(url.searchParams.get('limit') || 20);
  const offset = Number(url.searchParams.get('cursor') || 0);
  const items = Array.from({ length: 23 }, (_, index) => ({ ...liveVolume, node_id: 'volume-node-' + index, node_name: 'volume-node-' + index, volume_id: 'same-volume-id', path: '/disk/' + index, health: index === 0 ? 'missing' : 'healthy', capacity: index === 0 ? null : liveVolume.capacity, write_isolated: index === 0 }));
  return Response.json({ data: { items: items.slice(offset, offset + size), next_cursor: offset + size < items.length ? String(offset + size) : '' }, meta: { request_id: 'volume-fixture', generated_unix: 1, complete: false, errors: [{ node_id: 'unreachable-node', code: 'incomplete_volume_observation', message: 'Volume information missing' }] } });
};
await click(button('刷新当前页面'));
await wait(() => text().includes('本页 20 条') && text().includes('/disk/0'), 'volume fixture first page');
check('Same volume IDs on different nodes remain distinct rows', document.querySelectorAll('tbody tr').length === 20);
check('Unavailable volume retains null capacity and write isolation', text().includes('不可访问') && text().includes('已隔离') && text().includes('未知') && text().includes('部分状态缺失'));
await click(button('下一页'));
await wait(() => text().includes('本页 3 条') && text().includes('/disk/20'), 'volume second page');
check('Volume pagination counts volumes, not nodes', !button('上一页').disabled && button('下一页').disabled);
await select('每页条数', '每页 50 条');
await wait(() => text().includes('本页 23 条'), 'volume page size');
check('Volume page size resets cursor', button('上一页').disabled);
await select('筛选 Volume 所属区域', globalThis.liveNode.region_id);
await wait(() => !document.querySelector('[aria-label="筛选 Volume 所属节点"]').disabled, 'paged node options');
await click(document.querySelector('[aria-label="筛选 Volume 所属节点"]'));
check('Node choices load a bounded first page', document.querySelectorAll('[role="option"]').length === 51);
await click(button('加载更多节点'));
await wait(() => [...document.querySelectorAll('[role="option"]')].some(item => item.textContent === 'option-52'), 'next node choice page');
await click([...document.querySelectorAll('[role="option"]')].find(item => item.textContent === 'option-52'));
await wait(() => globalThis.lastVolumeFilter?.node_id === 'option-52', 'selected later-page node applied');
check('Later node pages remain selectable', globalThis.lastVolumeFilter.region === globalThis.liveNode.region_id);
await select('筛选 Volume 所属区域', '全部区域');
await wait(() => !globalThis.lastVolumeFilter.node_id && !globalThis.lastVolumeFilter.region, 'clear dependent filters');
check('Changing region never carries previous node ID', document.querySelector('[aria-label="筛选 Volume 所属节点"]').disabled);
volumeFailure = true;
await click(button('刷新当前页面'));
await wait(() => text().includes('Volume query unavailable'), 'volume failure');
check('Failed volume query keeps marked old results', text().includes('保留上次结果'));
globalThis.interceptor = undefined;
await click(button('监控与诊断'));
await wait(() => document.querySelector('.maintenance-node'), 'cluster maintenance');
check('Global maintenance endpoint connected', document.querySelectorAll('.maintenance-node').length === 3);
await click(button('A管理员Administrator'));
await click(button('当前入口信息'));
await wait(() => text().includes('入口与证书详细信息'), 'gateway info');
check('Gateway endpoint connected', text().includes('config'));

// Controlled responses cover errors, cursor boundaries and request races without
// stopping any real node or altering cluster data.
await click(button('区域与节点'));
await wait(() => text().includes('本页 3 条'), 'nodes again');
const liveNode = globalThis.liveNode;
check('Live API supplied node fixture schema', !!liveNode?.node_id);
let blocked = false;
let invalidCursor = false;
globalThis.interceptor = async (url) => {
  if (url.pathname === '/api/v1/admin/nodes') {
    if (blocked) return new Response(JSON.stringify({ message: 'Injected read failure' }), { status: 503 });
    const size = Number(url.searchParams.get('limit') || 20);
    const cursor = Number(url.searchParams.get('cursor') || 0);
    if (invalidCursor && cursor) return Response.json({ message: 'Injected invalid cursor' }, { status: 400 });
    const name = url.searchParams.get('name');
    if (name === 'slow') await new Promise(resolve => setTimeout(resolve, 450));
    const filtered = name ? (name === 'none' ? [] : [{ ...liveNode, name, node_id: 'filtered-' + name }]) : Array.from({ length: 24 }, (_, index) => ({ ...liveNode, name: 'node-' + index, node_id: 'id-' + index }));
    const data = { items: filtered.slice(cursor, cursor + size), next_cursor: cursor + size < filtered.length ? String(cursor + size) : '' };
    return Response.json({ data, meta: { request_id: 'ui-fixture', generated_unix: 1, complete: true, errors: [] } });
  }
};
await click(button('刷新当前页面'));
await wait(() => text().includes('本页 20 条'), 'first cursor page');
check('Default page size is 20', !button('下一页').disabled);
await click(button('下一页'));
await wait(() => text().includes('本页 4 条'), 'second page');
check('Next cursor applied; previous enabled', !button('上一页').disabled && button('下一页').disabled);
await select('筛选节点状态', '正常');
await wait(() => text().includes('本页 20 条'), 'new filter first page');
await select('筛选节点状态', '全部状态');
await wait(() => text().includes('本页 20 条') && !text().includes('正在读取'), 'restored filter first page');
check('Switching away and back resets cursor history', button('上一页').disabled);
await click(button('下一页'));
await wait(() => text().includes('本页 4 条'), 'second page again');
invalidCursor = true;
await click(button('刷新当前页面'));
await wait(() => text().includes('Injected invalid cursor'), 'invalid cursor');
await click(button('节点列表返回第一页'));
await wait(() => text().includes('本页 20 条') && !text().includes('Injected invalid cursor'), 'cursor recovery');
check('Invalid cursor can recover to first page', button('上一页').disabled);
invalidCursor = false;
await select('每页条数', '每页 50 条');
await wait(() => text().includes('本页 24 条'), 'size reset');
check('Changing page size starts at first page', button('上一页').disabled);
await input(document.querySelector('[aria-label="精确匹配节点名称"]'), 'none');
await submit(document.querySelector('.list-toolbar'));
await wait(() => text().includes('未找到匹配的节点'), 'empty state');
check('Empty list does not become unknown capacity zero', text().includes('完整节点名称'));
await input(document.querySelector('[aria-label="精确匹配节点名称"]'), 'slow');
await submit(document.querySelector('.list-toolbar'));
await input(document.querySelector('[aria-label="精确匹配节点名称"]'), 'fast');
await submit(document.querySelector('.list-toolbar'));
await wait(() => text().includes('filtered-fast'), 'fast query');
await act(async () => new Promise(resolve => setTimeout(resolve, 650)));
check('Late response cannot overwrite the latest filter', !text().includes('filtered-slow') && text().includes('filtered-fast'));
blocked = true;
await click(button('刷新当前页面'));
await wait(() => text().includes('Injected read failure'), 'request failure');
check('503 keeps previous result explicitly stale', text().includes('保留上次结果') && text().includes('filtered-fast'));
blocked = false;
await click(button('重试'));
await wait(() => !text().includes('Injected read failure'), 'retry');
check('Retry restores latest observation', text().includes('filtered-fast'));
globalThis.interceptor = async url => url.pathname === '/api/v1/admin/nodes' ? Response.json({ data: { items: [{ ...liveNode, name: 'offline', status: 'unavailable', capacity: null, volume_count: null, capacity_observed_volumes: null, observed_unix: null, stale: false, complete: false }], next_cursor: '' }, meta: { request_id: 'partial', generated_unix: 1, complete: false, errors: [{ node_id: liveNode.node_id, code: 'unavailable', message: 'Injected missing observation' }] } }) : undefined;
await click(button('刷新当前页面'));
await wait(() => text().includes('offline'), 'partial response');
check('Partial observations show unavailable and unknown', text().includes('不可达') && text().includes('未知') && text().includes('部分状态缺失'));
check('No NaN or undefined appears in UI', !/NaN|undefined/.test(text()));
globalThis.interceptor = async url => url.pathname === '/api/v1/admin/nodes' ? Response.json({ message: 'Injected denial' }, { status: 403 }) : undefined;
await click(button('刷新当前页面'));
await wait(() => text().includes('没有访问权限'), '403');
check('403 is distinguished from empty list', text().includes('Injected denial'));
globalThis.interceptor = async url => url.pathname === '/api/v1/admin/nodes' ? Response.json({ message: 'Injected expiry' }, { status: 401 }) : undefined;
await click(button('刷新当前页面'));
await wait(() => document.querySelector('#admin-token'), 'expired session');
check('401 clears authenticated UI', !document.querySelector('.sidebar') && text().includes('登录已过期'));
globalThis.interceptor = undefined;
await act(async () => root.unmount());
fs.writeFileSync('ui-check-results.json', JSON.stringify({ passed: results.length, checks: results, live_paths: [...globalThis.livePaths].sort() }, null, 2));
console.log(JSON.stringify({ passed: results.length, live_paths: globalThis.livePaths.size }));
