<script>
  import { getContext } from 'svelte'

  let { href, ...rest } = $props()

  const navigate = getContext('navigate')

  function onClick(e) {
    e.preventDefault()
    navigate(href)
  }
</script>

<a {href} onclick={onClick} {...rest}>
  {@render children()}
</a>
