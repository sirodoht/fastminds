<script>
  import { onMount } from "svelte";
  import { Router, Link, navigate } from "./router/index.js";
  import {
    notificationUnreadCount,
    refreshNotificationUnreadCount,
    user,
    logout,
    restoreSession,
  } from "./lib/stores.js";
  import Feed from "./pages/Feed.svelte";
  import Messages from "./pages/Messages.svelte";
  import Conversation from "./pages/Conversation.svelte";
  import Conversations from "./pages/Conversations.svelte";
  import ConversationDetail from "./pages/ConversationDetail.svelte";
  import PostDetail from "./pages/PostDetail.svelte";
  import Profile from "./pages/Profile.svelte";
  import NewPost from "./pages/NewPost.svelte";
  import Login from "./pages/Login.svelte";
  import Register from "./pages/Register.svelte";
  import NotFound from "./pages/NotFound.svelte";
  import ConversationSidebar from "./components/ConversationSidebar.svelte";

  onMount(async () => {
    await restoreSession();
  });

  let notificationSocket;

  function connectNotificationSocket() {
    const token = localStorage.getItem("token");
    if (!token || notificationSocket) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    notificationSocket = new WebSocket(`${protocol}//${window.location.host}/ws/messages?token=${encodeURIComponent(token)}`);

    notificationSocket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type !== "notification:new") return;

      notificationUnreadCount.update((count) => count + 1);
    });
  }

  $effect(() => {
    if ($user) {
      refreshNotificationUnreadCount();
      connectNotificationSocket();
    } else {
      notificationSocket?.close();
      notificationSocket = null;
    }
  });
</script>

<Router routes={{
  "/": Feed,
  "/messages": Messages,
  "/messages/:username": Conversation,
  "/conversations": Conversations,
  "/conversations/:id": ConversationDetail,
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
          <Link href="/conversations" class="notification-link">
            Conversations
            {#if $notificationUnreadCount > 0}
              <span class="notification-badge">{$notificationUnreadCount}</span>
            {/if}
          </Link>
        {/if}
      </nav>
      <div class="header-right">
        {#if $user}
          <Link href="/profile/{$user.username}" class="username">{$user.username}</Link>
          <button onclick={() => { logout(); navigate("/"); }}>
            Log out
          </button>
        {:else}
          <Link href="/login">Log in</Link>
          <Link href="/register">Register</Link>
        {/if}
      </div>
    </header>

    <div class="layout" class:messages-layout={matched?.key?.startsWith('/conversations/')}>
      <main class="content">
        {#if matched?.key?.startsWith('/conversations/')}
          <div class="messages-wrapper">
            <ConversationSidebar currentPath={matched.key} />
            <div class="messages-main">
              {#if matched}
                {#key matched.key}
                  {#each [matched.component] as Component}
                    <Component params={matched.params} />
                  {/each}
                {/key}
              {/if}
            </div>
          </div>
        {:else}
          {#if matched}
            {#key matched.key}
              {#each [matched.component] as Component}
                <Component params={matched.params} />
              {/each}
            {/key}
          {/if}
        {/if}
      </main>
      {#if !matched?.key?.startsWith('/conversations') && matched?.key !== '/new' && !matched?.key?.startsWith('/posts/') && !matched?.key?.startsWith('/profile/')}
        <aside class="sidebar">
          <div class="sidebar-card">
            <h3>fastminds</h3>
            <hr />
            <p>
                <strong>How it works</strong>
            </p>
            <ol>
                <li>Ask a question or post an idea about a specific topic.</li>
                <li>Receive private responses and start conversations.</li>
            </ol>
            <p>
                Conversations start anonymous and become pseudonymous.
                After 10 messages both participants see each other’s profile.
            </p>
            <p>
                Interlocutor can assign labels to each others after 10 messages in the same conversation.
            </p>
            <p>
                There is no score or ranking. There are labels that reflect what it's like talking to you.
                Labels decay over time. More weight is given to more recent labels.
            </p>
            <p>
                No followers. No likes. The feed is newest posts first, no algorithms.</p>
            <p>
                <strong>Core principles</strong>
            </p>
            <ul>
              <li>Ideas before identities</li>
              <li>Conversations before reputation</li>
              <li>Multi-dimensional labels instead of scores</li>
              <li>No popularity metrics</li>
              <li>No follower graph</li>
              <li>No algorithmic feed</li>
            </ul>
            {#if !$user}
              <Link href="/register" class="btn-primary">Create Account</Link>
            {/if}
          </div>
        </aside>
      {/if}
    </div>
  {/snippet}
</Router>
