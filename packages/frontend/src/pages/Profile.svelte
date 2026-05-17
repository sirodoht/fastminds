<script>
  import Link from "../router/Link.svelte";
  import { user } from "../lib/stores.js";

  let { params } = $props();

  let username = $derived(params.address);
  let isOwnProfile = $derived($user?.username === username);

</script>

<div class="profile-card">
  <div class="profile-header">
    <div class="profile-avatar">
      {username.charAt(0).toUpperCase()}
    </div>
    <div class="profile-info">
      <h1>u/{username}</h1>
      {#if !isOwnProfile}
        <Link href="/messages/{username}" class="btn-secondary" style="margin-top:8px">Message</Link>
      {/if}
    </div>
  </div>
</div>

<div class="panel" style="margin-top:12px">
  <div class="panel-header">Posts</div>
  <div class="panel-body" style="color:var(--text-muted);font-size:.85rem;text-align:center;padding:20px">
    No posts yet.
  </div>
</div>
