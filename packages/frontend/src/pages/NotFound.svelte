<script>
  import Link from "../router/Link.svelte";

  let { params } = $props();
</script>

<div class="not-found">
  <h1>404</h1>
  <p>This page doesn't exist.</p>
  <Link href="/" class="btn-primary">Go to Feed</Link>
</div>
