<script>
  import { onMount } from "svelte";
  import { Router, Link, navigate } from "./router/index.js";
  import {
    notificationUnreadCount,
    refreshNotificationUnreadCount,
    user,
    logout,
    restoreSession,
    resendVerification,
  } from "./lib/stores.js";
  import Feed from "./pages/Feed.svelte";
  import Conversations from "./pages/Conversations.svelte";
  import ConversationDetail from "./pages/ConversationDetail.svelte";
  import PostDetail from "./pages/PostDetail.svelte";
  import Profile from "./pages/Profile.svelte";
  import NewPost from "./pages/NewPost.svelte";
  import Bookmarks from "./pages/Bookmarks.svelte";
  import Login from "./pages/Login.svelte";
  import Register from "./pages/Register.svelte";
  import RegisterSuccess from "./pages/RegisterSuccess.svelte";
  import VerifyEmail from "./pages/VerifyEmail.svelte";
  import Settings from "./pages/Settings.svelte";
  import AdminModeration from "./pages/AdminModeration.svelte";
  import AdminConversations from "./pages/AdminConversations.svelte";
  import AdminConversationDetail from "./pages/AdminConversationDetail.svelte";
  import NotFound from "./pages/NotFound.svelte";
  import ConversationSidebar from "./components/ConversationSidebar.svelte";

  onMount(async () => {
    await restoreSession();
  });

  let notificationSocket;
  let dropdownOpen = $state(false);

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

<svelte:window onclick={() => { dropdownOpen = false; }} />

<Router routes={{
  "/": Feed,
  "/conversations": Conversations,
  "/conversations/:id": ConversationDetail,
    "/posts/:id": PostDetail,
    "/profile/:address": Profile,
    "/new": NewPost,
    "/bookmarks": Bookmarks,
    "/login": Login,
    "/register": Register,
    "/register/success": RegisterSuccess,
    "/verify-email": VerifyEmail,
    "/settings": Settings,
    "/admin/moderation": AdminModeration,
    "/admin/conversations": AdminConversations,
    "/admin/conversations/:id": AdminConversationDetail,
  }} fallback={NotFound}>
  {#snippet children(matched)}
    <header class="header">
      <div class="header-logo">
        <Link href="/">fastminds</Link>
      </div>
      <nav class="header-nav">
        <Link href="/">Questions</Link>
        {#if $user}
          <Link href="/conversations" class="notification-link">
            Conversations
            {#if $notificationUnreadCount > 0}
              <span class="notification-badge">{$notificationUnreadCount}</span>
            {/if}
          </Link>
        {/if}
        {#if $user && $user.emailVerified}
          <Link href="/new">New Post</Link>
        {/if}
      </nav>
      <div class="header-right">
        {#if $user}
          <div class="dropdown" class:open={dropdownOpen}>
            <button class="dropdown-toggle" onclick={(e) => { e.stopPropagation(); dropdownOpen = !dropdownOpen; }}>
              {$user.username}
            </button>
            <div class="dropdown-menu" role="menu" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
              <Link href="/profile/{$user.username}" onclick={() => { dropdownOpen = false; }}>Profile</Link>
              <Link href="/bookmarks" onclick={() => { dropdownOpen = false; }}>Bookmarks</Link>
              <Link href="/settings" onclick={() => { dropdownOpen = false; }}>Settings</Link>
              {#if $user.isAdmin}
                <Link href="/admin/moderation" onclick={() => { dropdownOpen = false; }}>Moderation</Link>
                <Link href="/admin/conversations" onclick={() => { dropdownOpen = false; }}>Conversations</Link>
              {/if}
              <button onclick={() => { dropdownOpen = false; logout(); navigate("/"); }}>
                Log out
              </button>
            </div>
          </div>
        {:else}
          <Link href="/login">Log in</Link>
          <Link href="/register">Register</Link>
        {/if}
      </div>
    </header>

    <div class="layout" class:messages-layout={matched?.key?.startsWith('/conversations/')}>
      <main class="content">
        {#if $user && !$user.emailVerified}
          <div class="verification-banner">
            <span>Please verify your email. Check your inbox or </span>
            <button onclick={async () => { await resendVerification(); alert('Verification email sent!'); }}>resend</button>
          </div>
        {/if}
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
            <p>A one-time $1 sign up fee is charged to filter out fake accounts.</p>
            {#if !$user}
              <Link href="/register" class="btn-primary">Create Account</Link>
            {/if}
          </div>
        </aside>
      {/if}
    </div>
  {/snippet}
</Router>

<style>
  .verification-banner {
    background: #cee3f8;
    border: 1px solid #5f99cf;
    color: #336699;
    padding: 12px 16px;
    border-radius: 3px;
    margin-bottom: 16px;
    font-size: 0.95rem;
  }
  .verification-banner button {
    background: none;
    border: none;
    color: #336699;
    text-decoration: underline;
    cursor: pointer;
    font-size: 0.95rem;
    padding: 0;
    margin: 0;
  }
  .verification-banner button:hover {
    color: #25476f;
  }
</style>
