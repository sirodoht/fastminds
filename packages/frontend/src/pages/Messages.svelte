<script>
  import { onMount } from "svelte";
  import { api } from "../lib/api.js";
  import { notificationUnreadCount, restoreSession, user } from "../lib/stores.js";
  import { navigate } from "../router/index.js";
  import Link from "../router/Link.svelte";

  let notifications = $state([]);
  let loading = $state(true);
  let error = $state("");

  function describe(notification) {
    if (notification.type === "direct_message") {
      return notification.body;
    }

    return notification.body;
  }

  onMount(async () => {
    if (!$user && localStorage.getItem("token")) {
      await restoreSession();
    }

    if (!$user) {
      navigate("/login");
      return;
    }

    try {
      const data = await api("/api/notifications");
      notifications = data.notifications;
      notificationUnreadCount.set(data.unreadCount);

      if (data.unreadCount > 0) {
        await api("/api/notifications/read-all", { method: "POST" });
        notificationUnreadCount.set(0);
        notifications = notifications.map((notification) => ({
          ...notification,
          read_at: notification.read_at ?? new Date().toISOString(),
        }));
      }
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  });
</script>

<div class="panel">
  <div class="panel-header">Notifications</div>

  {#if loading}
    <div class="panel-body" style="color:var(--text-muted)">Loading notifications…</div>
  {:else if error}
    <div class="panel-body form-error">{error}</div>
  {:else if notifications.length === 0}
    <div class="panel-body" style="color:var(--text-muted)">
      No notifications yet.
    </div>
  {:else}
    <div class="notification-list">
      {#each notifications as notification (notification.id)}
        <Link
          href={notification.href}
          class={`notification-row ${!notification.read_at ? "unread" : ""}`}
        >
          <span>{describe(notification)}</span>
          <small>{new Date(notification.created_at).toLocaleString()}</small>
        </Link>
      {/each}
    </div>
  {/if}
</div>
