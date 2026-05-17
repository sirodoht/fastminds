<script>
  import Link from "../router/Link.svelte";
  import { user } from "../lib/stores.js";

  let { params } = $props();

  let username = $derived(params.address);
  let isOwnProfile = $derived($user?.username === username);

  let profileUser = $state({
    bio: "Curious mind. Lover of paradoxes and late-night debates.",
    joined: "May 2026",
    postKarma: 42,
    commentKarma: 87,
  });
</script>

<div class="profile-card">
  <div class="profile-header">
    <div class="profile-avatar">
      {username.charAt(0).toUpperCase()}
    </div>
    <div class="profile-info">
      <h1>u/{username}</h1>
      {#if profileUser.bio}
        <div class="bio">{profileUser.bio}</div>
      {/if}
      {#if isOwnProfile}
        <button class="btn-secondary" style="margin-top:8px">Edit Profile</button>
      {:else}
        <Link href="/messages/{username}" class="btn-secondary" style="margin-top:8px">Message</Link>
      {/if}
    </div>
  </div>
  <dl class="profile-stats">
    <div>
      <dt>Post Karma</dt>
      <dd>{profileUser.postKarma}</dd>
    </div>
    <div>
      <dt>Comment Karma</dt>
      <dd>{profileUser.commentKarma}</dd>
    </div>
    <div>
      <dt>Joined</dt>
      <dd>{profileUser.joined}</dd>
    </div>
  </dl>
</div>

<div class="panel" style="margin-top:12px">
  <div class="panel-header">Posts</div>
  <div class="panel-body" style="color:var(--text-muted);font-size:.85rem;text-align:center;padding:20px">
    No posts yet.
  </div>
</div>
