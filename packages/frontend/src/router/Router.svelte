<script>
  import { setContext, onMount } from 'svelte'
  import { setNavigate } from './index.js'

  let { routes = {}, fallback = null, children } = $props()

  let currentPath = $state(window.location.pathname)

  let matched = $derived.by(() => {
    for (const [pattern, component] of Object.entries(routes)) {
      const keys = []
      const regexStr = pattern.replace(/:(\w+)/g, (_, key) => {
        keys.push(key)
        return '([^/]+)'
      })
      const regex = new RegExp(`^${regexStr}$`)
      const match = currentPath.match(regex)
      if (match) {
        const params = {}
        keys.forEach((key, i) => params[key] = decodeURIComponent(match[i + 1]))
        return { component, params }
      }
    }
    if (fallback) return { component: fallback, params: {} }
    return null
  })

  function navigate(path) {
    window.history.pushState({}, '', path)
    currentPath = path
  }

  setContext('navigate', navigate)
  setNavigate(navigate)

  onMount(() => {
    const handler = () => currentPath = window.location.pathname
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  })
</script>

{@render children()}

{#if matched}
  {#each [matched.component] as Component}
    <Component params={matched.params} />
  {/each}
{:else}
  <p>404 — page not found</p>
{/if}
