<script>
  import { getContext } from 'svelte'

  let { href, children, ...rest } = $props()

  const navigate = getContext('navigate')

  function onClick(e) {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.altKey ||
      e.ctrlKey ||
      e.shiftKey
    ) return

    e.preventDefault()
    navigate(href)
  }
</script>

<a {href} onclick={onClick} {...rest}>
  {@render children()}
</a>
