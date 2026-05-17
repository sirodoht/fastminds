<script>
  import { onMount } from "svelte";
  import { Router, Link, navigate } from "./router/index.js";
  import { user, logout, restoreSession } from "./lib/stores.js";
  import Feed from "./pages/Feed.svelte";
  import Messages from "./pages/Messages.svelte";
  import Conversation from "./pages/Conversation.svelte";
  import PostDetail from "./pages/PostDetail.svelte";
  import Profile from "./pages/Profile.svelte";
  import NewPost from "./pages/NewPost.svelte";
  import Login from "./pages/Login.svelte";
  import Register from "./pages/Register.svelte";
  import NotFound from "./pages/NotFound.svelte";

  onMount(async () => {
    await restoreSession();
  });
</script>

<Router routes={{
  "/": Feed,
  "/messages": Messages,
  "/messages/:username": Conversation,
  "/posts/:id": PostDetail,
  "/profile/:address": Profile,
  "/new": NewPost,
  "/login": Login,
  "/register": Register,
}} fallback={NotFound}>
  {#snippet children(matched)}
    <header class="header">
      <div class="header-logo">
        <Link href="/">fastminds</Link>
      </div>
      <nav class="header-nav">
        <Link href="/">Feed</Link>
        <Link href="/new">New Post</Link>
        {#if $user}
          <Link href="/messages">Messages</Link>
        {/if}
      </nav>
      <div class="header-right">
        {#if $user}
          <span class="username">{$user.username}</span>
          <Link href="/profile/{$user.username}">Profile</Link>
          <button onclick={() => { logout(); navigate("/"); }}>
            Log out
          </button>
        {:else}
          <Link href="/login">Log in</Link>
          <Link href="/register">Register</Link>
        {/if}
      </div>
    </header>

    <div class="layout">
      <main class="content">
        {#if matched}
          {#key matched.key}
            {#each [matched.component] as Component}
              <Component params={matched.params} />
            {/each}
          {/key}
        {/if}
      </main>
      <aside class="sidebar">
        <div class="sidebar-card">
          <h3>fastminds</h3>
          <p>Questions, arguments, paradoxes, and challenges from the community.</p>
          <p>Share your thoughts, challenge your mind.</p>
          {#if !$user}
            <Link href="/register" class="btn-primary">Create Account</Link>
          {/if}
        </div>
        <div class="sidebar-card">
          <h3>Stats</h3>
          <p>Join the conversation.</p>
        </div>
      </aside>
    </div>
  {/snippet}
</Router>
